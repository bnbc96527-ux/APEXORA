import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useWalletStore } from '../store/walletStore';
import { Icon } from '../components/Icon';
import PasswordField from '../components/PasswordField/PasswordField';
import GoogleRecaptcha from '../components/Security/GoogleRecaptcha';
import { useIsMobile } from '../hooks/useMediaQuery';
import { getUiLocale } from '../utils/locale';
import { LanguageToggle } from '../components/LanguageToggle';
import { ThemeToggle } from '../components/ThemeToggle';
import { useI18n, type LocaleKey } from '../i18n';
import { getAuthCopy } from './authCopy';
import styles from './AuthPage.module.css';

type AuthMode = 'login' | 'register' | 'forgot-password';
type RegisterStep = 'account' | 'email-verification' | 'security-setup' | 'complete';

const COUNTRY_OPTIONS = [
  { code: 'US' },
  { code: 'CA' },
  { code: 'GB' },
  { code: 'AU' },
  { code: 'DE' },
  { code: 'FR' },
  { code: 'JP' },
];

interface LoginActivity {
  id: string;
  timestamp: Date;
  device: string;
  location: string;
  status: 'success' | 'failed';
}

interface AuthCopy {
  title: string;
  subtitle: {
    login: string;
    registerAccount: string;
    registerVerifyEmail: string;
    registerSecuritySetup: string;
    registerComplete: string;
    forgotPassword: string;
  };
  newDevice: {
    title: string;
    description: string;
    dismiss: string;
  };
  fields: {
    email: string;
    emailPlaceholder: string;
    username: string;
    usernamePlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    confirmPassword: string;
    confirmPasswordPlaceholder: string;
    country: string;
    authenticatorCode: string;
    authenticatorPlaceholder: string;
    verificationCode: string;
    verificationPlaceholder: string;
    resetCode: string;
    resetCodePlaceholder: string;
    newPassword: string;
    newPasswordPlaceholder: string;
    confirmNewPassword: string;
    confirmNewPasswordPlaceholder: string;
  };
  actions: {
    rememberMe: string;
    forgotPassword: string;
    signIn: string;
    verifyAndSignIn: string;
    createAccount: string;
    continueSecurely: string;
    verifyEmail: string;
    resendCode: string;
    completeSetup: string;
    sendResetCode: string;
    resetPassword: string;
    backToLogin: string;
  };
  secure: {
    login: string;
    registration: string;
    reset: string;
  };
  register: {
    alreadyHave: string;
    emailTitle: string;
    emailDescription: (email: string) => string;
    twoFactorTitle: string;
    twoFactorDescription: string;
    qrDescription: string;
    qrPreparing: string;
    enable2FA: string;
    successTitle: string;
    successDescription: string;
    redirecting: string;
  };
  forgotPassword: {
    title: string;
    description: string;
  };
  activity: {
    title: string;
    status: {
      success: string;
      failed: string;
    };
  };
  badges: {
    sslSecure: string;
    twoFaReady: string;
  };
  engineStatus: {
    title: string;
    websocket: string;
    matching: string;
    security: string;
    connected: string;
    active: string;
    loading: string;
  };
  strength: {
    veryWeak: string;
    weak: string;
    good: string;
    strong: string;
    veryStrong: string;
  };
}

const AUTH_COPY: Record<LocaleKey, AuthCopy> = {
  'en-US': {
    title: 'APEXORA',
    subtitle: {
      login: 'Welcome Back',
      registerAccount: 'Create Account',
      registerVerifyEmail: 'Verify Email',
      registerSecuritySetup: 'Security Setup',
      registerComplete: 'Account Created',
      forgotPassword: 'Reset Password',
    },
    newDevice: {
      title: 'New Device Detected',
      description: "We noticed you're logging in from a new device. For your security, we've sent a verification code to your email.",
      dismiss: 'Dismiss',
    },
    fields: {
      email: 'Email Address',
      emailPlaceholder: 'Enter your email',
      username: 'Username',
      usernamePlaceholder: 'Choose a username',
      password: 'Password',
      passwordPlaceholder: 'Enter your password',
      confirmPassword: 'Confirm Password',
      confirmPasswordPlaceholder: 'Confirm your password',
      country: 'Country',
      authenticatorCode: 'Authenticator Code',
      authenticatorPlaceholder: '000000',
      verificationCode: 'Verification Code',
      verificationPlaceholder: '000000',
      resetCode: 'Reset Code',
      resetCodePlaceholder: '000000',
      newPassword: 'New Password',
      newPasswordPlaceholder: 'Create a new password',
      confirmNewPassword: 'Confirm New Password',
      confirmNewPasswordPlaceholder: 'Confirm new password',
    },
    actions: {
      rememberMe: 'Remember me',
      forgotPassword: 'Forgot password?',
      signIn: 'Sign In',
      verifyAndSignIn: 'Verify and Sign In',
      createAccount: 'Create Account',
      continueSecurely: 'Continue Securely',
      verifyEmail: 'Verify Email',
      resendCode: 'Resend Code',
      completeSetup: 'Complete Setup',
      sendResetCode: 'Send Reset Code',
      resetPassword: 'Reset Password',
      backToLogin: 'Back to Login',
    },
    secure: {
      login: 'Secure Login Verification',
      registration: 'Secure Registration Verification',
      reset: 'Secure Reset Verification',
    },
    register: {
      alreadyHave: 'Already have an account?',
      emailTitle: 'Email Verification',
      emailDescription: (email) => `We have sent a 6-digit verification code to ${email}`,
      twoFactorTitle: 'Two-Factor Authentication',
      twoFactorDescription: 'Add an extra layer of security to your account. This step is optional but recommended.',
      qrDescription: 'Scan this QR code with Google Authenticator or another TOTP app.',
      qrPreparing: 'Preparing secure QR code...',
      enable2FA: 'Enable 2FA for enhanced security',
      successTitle: 'Account Created Successfully!',
      successDescription: 'Welcome to Apexora. Your account has been created and secured.',
      redirecting: 'Redirecting to login...',
    },
    forgotPassword: {
      title: 'Reset Your Password',
      description: "Enter your email address and we'll send you a secure reset code.",
    },
    activity: {
      title: 'Recent Login Activity',
      status: {
        success: 'success',
        failed: 'failed',
      },
    },
    badges: {
      sslSecure: 'SSL SECURE',
      twoFaReady: '2FA READY',
    },
    engineStatus: {
      title: 'Real-Time Engine Status',
      websocket: 'WebSocket',
      matching: 'Matching',
      security: 'Security',
      connected: 'Connected',
      active: 'Active',
      loading: '...',
    },
    strength: {
      veryWeak: 'Very Weak',
      weak: 'Weak',
      good: 'Good',
      strong: 'Strong',
      veryStrong: 'Very Strong',
    },
  },
  'zh-CN': {
    title: 'APEXORA',
    subtitle: {
      login: '欢迎回来',
      registerAccount: '创建账户',
      registerVerifyEmail: '验证邮箱',
      registerSecuritySetup: '安全设置',
      registerComplete: '账户已创建',
      forgotPassword: '重置密码',
    },
    newDevice: {
      title: '检测到新设备',
      description: '我们发现你正在从新设备登录。为了安全起见，我们已向你的邮箱发送验证码。',
      dismiss: '关闭',
    },
    fields: {
      email: '邮箱地址',
      emailPlaceholder: '请输入邮箱',
      username: '用户名',
      usernamePlaceholder: '请输入用户名',
      password: '密码',
      passwordPlaceholder: '请输入密码',
      confirmPassword: '确认密码',
      confirmPasswordPlaceholder: '请再次输入密码',
      country: '国家/地区',
      authenticatorCode: '验证器代码',
      authenticatorPlaceholder: '000000',
      verificationCode: '验证码',
      verificationPlaceholder: '000000',
      resetCode: '重置码',
      resetCodePlaceholder: '000000',
      newPassword: '新密码',
      newPasswordPlaceholder: '创建新密码',
      confirmNewPassword: '确认新密码',
      confirmNewPasswordPlaceholder: '请再次输入新密码',
    },
    actions: {
      rememberMe: '记住我',
      forgotPassword: '忘记密码？',
      signIn: '登录',
      verifyAndSignIn: '验证并登录',
      createAccount: '创建账户',
      continueSecurely: '安全继续',
      verifyEmail: '验证邮箱',
      resendCode: '重新发送',
      completeSetup: '完成设置',
      sendResetCode: '发送重置码',
      resetPassword: '重置密码',
      backToLogin: '返回登录',
    },
    secure: {
      login: '安全登录验证',
      registration: '安全注册验证',
      reset: '安全重置验证',
    },
    register: {
      alreadyHave: '已有账户？',
      emailTitle: '邮箱验证',
      emailDescription: (email) => `我们已向 ${email} 发送了 6 位验证码`,
      twoFactorTitle: '双重验证',
      twoFactorDescription: '为账户增加额外保护。此步骤可选，但建议启用。',
      qrDescription: '使用 Google Authenticator 或其他 TOTP 应用扫描此二维码。',
      qrPreparing: '正在生成安全二维码...',
      enable2FA: '启用 2FA 提升安全性',
      successTitle: '账户创建成功！',
      successDescription: '欢迎来到 Apexora。你的账户已创建并加固。',
      redirecting: '正在返回登录...',
    },
    forgotPassword: {
      title: '重置密码',
      description: '请输入邮箱地址，我们会发送安全重置码。',
    },
    activity: {
      title: '最近登录活动',
      status: {
        success: '成功',
        failed: '失败',
      },
    },
    badges: {
      sslSecure: 'SSL 安全',
      twoFaReady: '已支持 2FA',
    },
    engineStatus: {
      title: '实时引擎状态',
      websocket: 'WebSocket',
      matching: '撮合',
      security: '安全',
      connected: '已连接',
      active: '运行中',
      loading: '...',
    },
    strength: {
      veryWeak: '非常弱',
      weak: '较弱',
      good: '良好',
      strong: '强',
      veryStrong: '非常强',
    },
  },
  'ja-JP': {
    title: 'APEXORA',
    subtitle: {
      login: 'お帰りなさい',
      registerAccount: 'アカウント作成',
      registerVerifyEmail: 'メール確認',
      registerSecuritySetup: 'セキュリティ設定',
      registerComplete: 'アカウント作成完了',
      forgotPassword: 'パスワード再設定',
    },
    newDevice: {
      title: '新しいデバイスを検出しました',
      description: '新しいデバイスからのログインを確認しました。安全のため、確認コードをメールで送信しました。',
      dismiss: '閉じる',
    },
    fields: {
      email: 'メールアドレス',
      emailPlaceholder: 'メールアドレスを入力',
      username: 'ユーザー名',
      usernamePlaceholder: 'ユーザー名を選択',
      password: 'パスワード',
      passwordPlaceholder: 'パスワードを入力',
      confirmPassword: 'パスワード確認',
      confirmPasswordPlaceholder: 'パスワードを再入力',
      country: '国',
      authenticatorCode: '認証コード',
      authenticatorPlaceholder: '000000',
      verificationCode: '確認コード',
      verificationPlaceholder: '000000',
      resetCode: '再設定コード',
      resetCodePlaceholder: '000000',
      newPassword: '新しいパスワード',
      newPasswordPlaceholder: '新しいパスワードを作成',
      confirmNewPassword: '新しいパスワード確認',
      confirmNewPasswordPlaceholder: '新しいパスワードを再入力',
    },
    actions: {
      rememberMe: '次回から自動的にログイン',
      forgotPassword: 'パスワードをお忘れですか？',
      signIn: 'サインイン',
      verifyAndSignIn: '確認してサインイン',
      createAccount: 'アカウント作成',
      continueSecurely: '安全に続行',
      verifyEmail: 'メールを確認',
      resendCode: 'コードを再送信',
      completeSetup: '設定を完了',
      sendResetCode: '再設定コードを送信',
      resetPassword: 'パスワードを再設定',
      backToLogin: 'ログインへ戻る',
    },
    secure: {
      login: '安全なログイン確認',
      registration: '安全な登録確認',
      reset: '安全な再設定確認',
    },
    register: {
      alreadyHave: 'すでにアカウントをお持ちですか？',
      emailTitle: 'メール確認',
      emailDescription: (email) => `${email} に 6 桁の確認コードを送信しました`,
      twoFactorTitle: '二要素認証',
      twoFactorDescription: 'アカウントに追加の保護を加えます。任意ですが推奨です。',
      qrDescription: 'Google Authenticator などの TOTP アプリでこの QR コードをスキャンしてください。',
      qrPreparing: '安全な QR コードを準備中...',
      enable2FA: 'セキュリティ向上のため 2FA を有効化',
      successTitle: 'アカウントが正常に作成されました！',
      successDescription: 'Apexora へようこそ。アカウントは作成され保護されました。',
      redirecting: 'ログイン画面へ移動中...',
    },
    forgotPassword: {
      title: 'パスワードを再設定',
      description: 'メールアドレスを入力すると、安全な再設定コードを送信します。',
    },
    activity: {
      title: '最近のログイン履歴',
      status: {
        success: '成功',
        failed: '失敗',
      },
    },
    badges: {
      sslSecure: 'SSL 保護',
      twoFaReady: '2FA 対応',
    },
    engineStatus: {
      title: 'リアルタイムエンジン状態',
      websocket: 'WebSocket',
      matching: 'マッチング',
      security: 'セキュリティ',
      connected: '接続済み',
      active: '稼働中',
      loading: '...',
    },
    strength: {
      veryWeak: '非常に弱い',
      weak: '弱い',
      good: '良い',
      strong: '強い',
      veryStrong: '非常に強い',
    },
  },
  'es-ES': { ...AUTH_COPY_PLACEHOLDER_ENGLISH('es-ES') },
  'fr-FR': { ...AUTH_COPY_PLACEHOLDER_ENGLISH('fr-FR') },
  'ko-KR': { ...AUTH_COPY_PLACEHOLDER_ENGLISH('ko-KR') },
  'pt-BR': { ...AUTH_COPY_PLACEHOLDER_ENGLISH('pt-BR') },
  'ar-SA': { ...AUTH_COPY_PLACEHOLDER_ENGLISH('ar-SA') },
};

function AUTH_COPY_PLACEHOLDER_ENGLISH(locale: LocaleKey = 'en-US'): AuthCopy {
  return {
    title: 'APEXORA',
    subtitle: {
      login: 'Welcome Back',
      registerAccount: 'Create Account',
      registerVerifyEmail: 'Verify Email',
      registerSecuritySetup: 'Security Setup',
      registerComplete: 'Account Created',
      forgotPassword: 'Reset Password',
    },
    newDevice: {
      title: 'New Device Detected',
      description: "We noticed you're logging in from a new device. For your security, we've sent a verification code to your email.",
      dismiss: 'Dismiss',
    },
    fields: {
      email: 'Email Address',
      emailPlaceholder: 'Enter your email',
      username: 'Username',
      usernamePlaceholder: 'Choose a username',
      password: 'Password',
      passwordPlaceholder: 'Enter your password',
      confirmPassword: 'Confirm Password',
      confirmPasswordPlaceholder: 'Confirm your password',
      country: 'Country',
      authenticatorCode: 'Authenticator Code',
      authenticatorPlaceholder: '000000',
      verificationCode: 'Verification Code',
      verificationPlaceholder: '000000',
      resetCode: 'Reset Code',
      resetCodePlaceholder: '000000',
      newPassword: 'New Password',
      newPasswordPlaceholder: 'Create a new password',
      confirmNewPassword: 'Confirm New Password',
      confirmNewPasswordPlaceholder: 'Confirm new password',
    },
    actions: {
      rememberMe: 'Remember me',
      forgotPassword: 'Forgot password?',
      signIn: 'Sign In',
      verifyAndSignIn: 'Verify and Sign In',
      createAccount: 'Create Account',
      continueSecurely: 'Continue Securely',
      verifyEmail: 'Verify Email',
      resendCode: 'Resend Code',
      completeSetup: 'Complete Setup',
      sendResetCode: 'Send Reset Code',
      resetPassword: 'Reset Password',
      backToLogin: 'Back to Login',
    },
    secure: {
      login: 'Secure Login Verification',
      registration: 'Secure Registration Verification',
      reset: 'Secure Reset Verification',
    },
    register: {
      alreadyHave: 'Already have an account?',
      emailTitle: 'Email Verification',
      emailDescription: (email) => `We have sent a 6-digit verification code to ${email}`,
      twoFactorTitle: 'Two-Factor Authentication',
      twoFactorDescription: 'Add an extra layer of security to your account. This step is optional but recommended.',
      qrDescription: 'Scan this QR code with Google Authenticator or another TOTP app.',
      qrPreparing: 'Preparing secure QR code...',
      enable2FA: 'Enable 2FA for enhanced security',
      successTitle: 'Account Created Successfully!',
      successDescription: 'Welcome to Apexora. Your account has been created and secured.',
      redirecting: 'Redirecting to login...',
    },
    forgotPassword: {
      title: 'Reset Your Password',
      description: "Enter your email address and we'll send you a secure reset code.",
    },
    activity: {
      title: 'Recent Login Activity',
      status: {
        success: 'success',
        failed: 'failed',
      },
    },
    badges: {
      sslSecure: 'SSL SECURE',
      twoFaReady: '2FA READY',
    },
    engineStatus: {
      title: 'Real-Time Engine Status',
      websocket: 'WebSocket',
      matching: 'Matching',
      security: 'Security',
      connected: 'Connected',
      active: 'Active',
      loading: '...',
    },
    strength: {
      veryWeak: 'Very Weak',
      weak: 'Weak',
      good: 'Good',
      strong: 'Strong',
      veryStrong: 'Very Strong',
    },
  };
}

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { locale } = useI18n();
  const {
    user,
    login,
    register,
    verifyEmail,
    resendVerification,
    requestPasswordReset,
    resetPassword,
    setupTwoFactor,
    confirmTwoFactor,
    isAuthenticated,
    isLoading,
    isInitialized,
    markAsInitialized,
  } = useAuthStore();
  const { grantInitialFunds, hasReceivedInitialGrant } = useWalletStore();
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;
  const auth = getAuthCopy(locale);

  // Main state
  const [mode, setMode] = useState<AuthMode>('login');
  const [registerStep, setRegisterStep] = useState<RegisterStep>('account');

  // Form fields
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [country, setCountry] = useState('US');
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordResetRequested, setPasswordResetRequested] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');

  // Security features
  const [error, setError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showDeviceAlert, setShowDeviceAlert] = useState(false);
  const [loginNeedsTwoFactor, setLoginNeedsTwoFactor] = useState(false);
  const [setupQrCode, setSetupQrCode] = useState<string | null>(null);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [loginActivity, setLoginActivity] = useState<LoginActivity[]>([]);
  const countryMenuRef = useRef<HTMLDivElement | null>(null);

  // System status
  const [systemCheck, setSystemCheck] = useState({
    ws: 'pending',
    engine: 'pending',
    security: 'pending',
  });

  useEffect(() => {
    if (isAuthenticated) {
      if (mode === 'register' && registerStep !== 'complete') {
        return;
      }
      // Grant initial funds if not already done
      if (!isInitialized && !hasReceivedInitialGrant) {
        const granted = grantInitialFunds();
        if (granted) {
          markAsInitialized();
        }
      }
      navigate('/trade');
    }
  }, [isAuthenticated, isInitialized, hasReceivedInitialGrant, grantInitialFunds, markAsInitialized, navigate, mode, registerStep]);

  // Simulate system checks on mount
  useEffect(() => {
    const runChecks = async () => {
      await new Promise(r => setTimeout(r, 600));
      setSystemCheck(prev => ({ ...prev, ws: 'ok' }));
      await new Promise(r => setTimeout(r, 400));
      setSystemCheck(prev => ({ ...prev, engine: 'ok' }));
      await new Promise(r => setTimeout(r, 500));
      setSystemCheck(prev => ({ ...prev, security: 'ok' }));
    };
    runChecks();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!countryMenuRef.current) return;
      if (!countryMenuRef.current.contains(event.target as Node)) {
        setCountryMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCountryMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const countryLabels = useMemo(() => {
    try {
      const displayNames = new Intl.DisplayNames([locale], { type: 'region' });
      return Object.fromEntries(
        COUNTRY_OPTIONS.map((option) => [option.code, displayNames.of(option.code) || option.code])
      ) as Record<string, string>;
    } catch {
      return Object.fromEntries(COUNTRY_OPTIONS.map((option) => [option.code, option.code])) as Record<string, string>;
    }
  }, [locale]);

  const selectedCountryLabel = countryLabels[country] || auth.fields.selectCountry;

  const validateLoginForm = (): boolean => {
    setError(null);

    if (!email.trim()) {
      setError(auth.errors.emailRequired);
      return false;
    }

    if (!password) {
      setError(auth.errors.passwordRequired);
      return false;
    }

    if (!captchaToken) {
      setError(auth.errors.captchaRequired);
      return false;
    }

    if (loginNeedsTwoFactor && twoFactorCode.trim().length !== 6) {
      setError(auth.errors.authenticatorRequired);
      return false;
    }

    return true;
  };

  const validateRegisterStep = (): boolean => {
    setError(null);

    if (registerStep === 'account') {
      if (!email.trim()) {
        setError(auth.errors.emailRequired);
        return false;
      }

      if (!username.trim()) {
        setError(auth.errors.usernameRequired);
        return false;
      }

      if (!password) {
        setError(auth.errors.passwordRequired);
        return false;
      }

      if (passwordStrength < 60) {
        setError(auth.errors.weakPassword);
        return false;
      }

      if (password !== confirmPassword) {
        setError(auth.errors.passwordsMismatch);
        return false;
      }

      if (!country) {
        setError(auth.errors.countryRequired);
        return false;
      }

      if (!captchaToken) {
        setError(auth.errors.captchaRequired);
        return false;
      }
    }

    if (registerStep === 'email-verification') {
      if (!verificationCode || verificationCode.length !== 6) {
        setError(auth.errors.verificationRequired);
        return false;
      }
    }

    if (registerStep === 'security-setup' && twoFactorEnabled && twoFactorCode.trim().length !== 6) {
      setError(auth.errors.authenticatorRequired);
      return false;
    }

    return true;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateLoginForm()) return;

    setError(null);

    const result = await login(email.trim(), password, {
      captchaToken,
      twoFactorCode: loginNeedsTwoFactor ? twoFactorCode : undefined,
    });
    if (result.success) {
      // Check for new device
      const isNewDevice = checkDeviceFingerprint();
      if (isNewDevice) {
        setShowDeviceAlert(true);
        addLoginActivity('success');
      } else {
        addLoginActivity('success');
      }

      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('savedEmail', email);
      }
      setLoginNeedsTwoFactor(false);
      setTwoFactorCode('');
    } else {
      if (result.requiresTwoFactor) {
        setLoginNeedsTwoFactor(true);
        setError(result.error || auth.errors.loginTwoFactorRequired);
      } else {
        setError(result.error || auth.errors.loginFailed);
      }
      addLoginActivity('failed');
    }
  };

  const handleRegisterNext = async () => {
    if (!validateRegisterStep()) return;

    if (registerStep === 'account') {
      const result = await register(username.trim(), email.trim(), password, {
        country,
        captchaToken,
      });
      if (!result.success) {
        setError(result.error || auth.errors.registrationFailed);
        return;
      }
      setRegisterStep('email-verification');
      if (result.devVerificationCode) {
        setVerificationCode(result.devVerificationCode);
      }
    } else if (registerStep === 'email-verification') {
      const result = await verifyEmail(email.trim(), verificationCode.trim());
      if (!result.success) {
        setError(result.error || auth.errors.verificationFailed);
        return;
      }
      if (twoFactorEnabled) {
        const setup = await setupTwoFactor();
        if (!setup.success) {
          setError(setup.error || auth.errors.startTwoFactorFailed);
          return;
        }
        setSetupQrCode(setup.qrCodeDataUrl || null);
        setSetupSecret(setup.secret || null);
        setRegisterStep('security-setup');
        return;
      }
      setRegisterStep('complete');
      setTimeout(() => {
        setMode('login');
        setRegisterStep('account');
      }, 2500);
    } else if (registerStep === 'security-setup') {
      if (twoFactorEnabled) {
        const result = await confirmTwoFactor(twoFactorCode.trim());
        if (!result.success) {
          setError(result.error || auth.errors.twoFactorSetupFailed);
          return;
        }
        setRegisterStep('complete');
        setTimeout(() => {
          setMode('login');
          setRegisterStep('account');
        }, 2500);
      } else {
        setRegisterStep('complete');
        setTimeout(() => {
          setMode('login');
          setRegisterStep('account');
        }, 2500);
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError(auth.errors.enterEmailAddress);
      return;
    }
    setError(null);
    const result = await requestPasswordReset(email.trim(), captchaToken);
    if (!result.success) {
      setError(result.error || auth.errors.passwordResetRequestFailed);
      return;
    }
    setPasswordResetRequested(true);
    if (result.devResetCode) {
      setResetCode(result.devResetCode);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setError(auth.errors.enterEmailAddress);
      return;
    }
    if (!resetCode.trim() || resetCode.trim().length !== 6) {
      setError(auth.errors.resetCodeRequired);
      return;
    }
    if (!newPassword || newPassword.length < 10) {
      setError(auth.errors.passwordTooShort);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError(auth.errors.passwordsMismatch);
      return;
    }

    const result = await resetPassword(email.trim(), resetCode.trim(), newPassword);
    if (!result.success) {
      setError(result.error || auth.errors.passwordResetFailed);
      return;
    }

    setMode('login');
    setPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setResetCode('');
    setPasswordResetRequested(false);
    setError(auth.errors.passwordUpdatedSuccess);
  };

  const checkDeviceFingerprint = (): boolean => {
    const deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      const newDeviceId = Math.random().toString(36).substring(7);
      localStorage.setItem('deviceId', newDeviceId);
      return true;
    }
    return false;
  };

  const addLoginActivity = (status: 'success' | 'failed') => {
    const activity: LoginActivity = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      device: navigator.userAgent.split(' ').pop() || 'Unknown',
      location: auth.activity.location,
      status,
    };
    setLoginActivity(prev => [activity, ...prev.slice(0, 9)]); // Keep last 10 activities
  };

  // Security Enhancement Functions
  const calculatePasswordStrength = (pwd: string): number => {
    let strength = 0;
    if (pwd.length >= 8) strength += 25;
    if (/[A-Z]/.test(pwd)) strength += 25;
    if (/[a-z]/.test(pwd)) strength += 15;
    if (/[0-9]/.test(pwd)) strength += 15;
    if (/[^A-Za-z0-9]/.test(pwd)) strength += 20;
    return Math.min(strength, 100);
  };

  const getPasswordStrengthLabel = (strength: number): string => {
    if (strength < 25) return auth.strength.veryWeak;
    if (strength < 50) return auth.strength.weak;
    if (strength < 75) return auth.strength.good;
    if (strength < 90) return auth.strength.strong;
    return auth.strength.veryStrong;
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    setPasswordStrength(calculatePasswordStrength(newPassword));
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError(null);
    setRegisterStep('account');
    setConfirmPassword('');
    setPassword('');
    setPasswordStrength(0);
    setCaptchaToken('');
    setVerificationCode('');
    setTwoFactorEnabled(false);
    setLoginNeedsTwoFactor(false);
    setTwoFactorCode('');
    setPasswordResetRequested(false);
    setResetCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    setSetupQrCode(null);
    setSetupSecret(null);
    setCountryMenuOpen(false);
  };

  const handleBackToLogin = () => {
    setMode('login');
    setRegisterStep('account');
    setError(null);
    setVerificationCode('');
    setTwoFactorEnabled(false);
    setLoginNeedsTwoFactor(false);
    setTwoFactorCode('');
    setCaptchaToken('');
    setCountryMenuOpen(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.decor}>
        <div className={styles.grid} />
      </div>
      <div className={styles.overlay} />
      
      {/* Quick Settings Bar - Desktop Only */}
      {!isMobile && (
        <div className={styles.settingsBar}>
          <LanguageToggle />
          <div className={styles.settingsDivider} />
          <ThemeToggle />
        </div>
      )}

      <div className={styles.card}>
        {/* Dynamic Header */}
        <div className={styles.header}>
          <div className={styles.logo}>
            <Icon name="activity" size={isMobile ? "lg" : "xl"} strokeWidth={3} />
          </div>
          <span className={styles.title}>{auth.title}</span>
          <p className={styles.subtitle}>
            {mode === 'login' && auth.subtitle.login}
            {mode === 'register' && registerStep === 'account' && auth.subtitle.registerAccount}
            {mode === 'register' && registerStep === 'email-verification' && auth.subtitle.registerVerifyEmail}
            {mode === 'register' && registerStep === 'security-setup' && auth.subtitle.registerSecuritySetup}
            {mode === 'register' && registerStep === 'complete' && auth.subtitle.registerComplete}
            {mode === 'forgot-password' && auth.subtitle.forgotPassword}
          </p>
        </div>

        {/* Progress Indicator for Registration */}
        {mode === 'register' && registerStep !== 'complete' && (
          <div className={styles.progressContainer}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: registerStep === 'account' ? '25%' :
                         registerStep === 'email-verification' ? '50%' :
                         registerStep === 'security-setup' ? '75%' : '100%'
                }}
              />
            </div>
            <div className={styles.progressSteps}>
              <span className={registerStep === 'account' ? styles.activeStep : styles.completedStep}>1</span>
              <span className={registerStep === 'email-verification' ? styles.activeStep : registerStep === 'account' ? styles.pendingStep : styles.completedStep}>2</span>
              <span className={registerStep === 'security-setup' ? styles.activeStep : ['account', 'email-verification'].includes(registerStep) ? styles.pendingStep : styles.completedStep}>3</span>
            </div>
          </div>
        )}

        {/* Device Alert */}
        {showDeviceAlert && (
          <div className={styles.deviceAlert}>
            <Icon name="alert-triangle" size="sm" />
            <div className={styles.alertContent}>
              <h4>{auth.newDevice.title}</h4>
              <p>{auth.newDevice.description}</p>
              <button
                className={styles.alertButton}
                onClick={() => setShowDeviceAlert(false)}
              >
                {auth.newDevice.dismiss}
              </button>
            </div>
          </div>
        )}

        {/* Login Form */}
        {mode === 'login' && (
          <form className={styles.form} onSubmit={handleLogin}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>{auth.fields.email}</label>
              <div className={styles.inputWrapper}>
                <Icon name="mail" size="sm" className={styles.inputIcon} />
                <input
                  type="email"
                  className={styles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={auth.fields.emailPlaceholder}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>{auth.fields.password}</label>
              <div>
                <PasswordField
                  id="login-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={auth.fields.passwordPlaceholder}
                  autoComplete="current-password"
                />
              </div>
            </div>

            {loginNeedsTwoFactor && (
              <div className={styles.inputGroup}>
                <label className={styles.label}>{auth.fields.authenticatorCode}</label>
                <div className={styles.inputWrapper}>
                  <Icon name="smartphone" size="sm" className={styles.inputIcon} />
                  <input
                    type="text"
                    className={styles.input}
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={auth.fields.authenticatorPlaceholder}
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                </div>
              </div>
            )}

            <div className={styles.formOptions}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>{auth.actions.rememberMe}</span>
              </label>
              <button
                type="button"
                className={styles.forgotPassword}
                onClick={() => setMode('forgot-password')}
              >
                {auth.actions.forgotPassword}
              </button>
            </div>

            <div className={styles.captchaContainer}>
              <div className={styles.secureLoginHeader}>
                <Icon name="shield-check" size="sm" />
                <span>{auth.secure.login}</span>
              </div>
              <GoogleRecaptcha
                siteKey={recaptchaSiteKey || ''}
                onToken={setCaptchaToken}
                onExpired={() => setCaptchaToken('')}
                onError={() => setCaptchaToken('')}
                className={styles.recaptchaBox}
              />
            </div>

            {error && (
              <div className={styles.errorMessage}>
                <Icon name="alert-circle" size="sm" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isLoading || !captchaToken}
            >
              {isLoading ? (
                <Icon name="loader" className={styles.spinner} />
              ) : (
                loginNeedsTwoFactor ? auth.actions.verifyAndSignIn : auth.actions.signIn
              )}
            </button>

            <div className={styles.modeSwitch}>
              <span className={styles.modeSwitchText}>{auth.actions.newTo}</span>
              <button
                type="button"
                className={styles.modeSwitchBtn}
                onClick={toggleMode}
              >
                {auth.actions.createAccount}
              </button>
            </div>
          </form>
        )}

        {/* Registration Form */}
        {mode === 'register' && (
          <div className={styles.registerContainer}>
            {registerStep === 'account' && (
              <form className={styles.form} onSubmit={(e) => { e.preventDefault(); handleRegisterNext(); }}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>{auth.fields.email}</label>
                  <div className={styles.inputWrapper}>
                    <Icon name="mail" size="sm" className={styles.inputIcon} />
                    <input
                      type="email"
                      className={styles.input}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={auth.fields.emailPlaceholder}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>{auth.fields.username}</label>
                  <div className={styles.inputWrapper}>
                    <Icon name="user" size="sm" className={styles.inputIcon} />
                    <input
                      type="text"
                      className={styles.input}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={auth.fields.usernamePlaceholder}
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>{auth.fields.password}</label>
                  <div>
                    <PasswordField
                      id="register-password"
                      value={password}
                      onChange={handlePasswordChange}
                      placeholder={auth.fields.passwordPlaceholder}
                      autoComplete="new-password"
                      showStrength
                      strength={passwordStrength}
                      strengthLabel={getPasswordStrengthLabel(passwordStrength)}
                    />
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>{auth.fields.confirmPassword}</label>
                  <div className={styles.inputWrapper}>
                    <Icon name="lock" size="sm" className={styles.inputIcon} />
                    <input
                      type="password"
                      className={styles.input}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={auth.fields.confirmPasswordPlaceholder}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>{auth.fields.country}</label>
                  <div className={styles.countrySelect} ref={countryMenuRef}>
                    <button
                      type="button"
                      className={styles.countrySelectTrigger}
                      onClick={() => setCountryMenuOpen((value) => !value)}
                      aria-haspopup="listbox"
                      aria-expanded={countryMenuOpen}
                    >
                      <div className={styles.countrySelectValueWrap}>
                        <Icon name="map-pin" size="sm" className={styles.inputIcon} />
                        <div className={styles.countrySelectText}>
                          <span className={styles.countrySelectValue}>{selectedCountryLabel}</span>
                          <span className={styles.countrySelectMeta}>{country}</span>
                        </div>
                      </div>
                      <Icon name="chevron-down" size="sm" className={`${styles.countryChevron} ${countryMenuOpen ? styles.countryChevronOpen : ''}`} />
                    </button>
                    {countryMenuOpen && (
                      <div className={styles.countrySelectMenu} role="listbox">
                        {COUNTRY_OPTIONS.map((option) => (
                          <button
                            key={option.code}
                            type="button"
                            className={`${styles.countryOption} ${country === option.code ? styles.countryOptionActive : ''}`}
                            onClick={() => {
                              setCountry(option.code);
                              setCountryMenuOpen(false);
                            }}
                          >
                            <span>{countryLabels[option.code] || option.code}</span>
                            <span>{option.code}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.captchaContainer}>
                  <div className={styles.secureLoginHeader}>
                    <Icon name="shield-check" size="sm" />
                    <span>{auth.secure.registration}</span>
                  </div>
                  <GoogleRecaptcha
                    siteKey={recaptchaSiteKey || ''}
                    onToken={setCaptchaToken}
                    onExpired={() => setCaptchaToken('')}
                    onError={() => setCaptchaToken('')}
                    className={styles.recaptchaBox}
                  />
                </div>

                {error && (
                  <div className={styles.errorMessage}>
                    <Icon name="alert-circle" size="sm" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={!captchaToken}
                >
                  {auth.actions.continueSecurely}
                </button>

                <div className={styles.modeSwitch}>
                  <span className={styles.modeSwitchText}>{auth.register.alreadyHave}</span>
                  <button
                    type="button"
                    className={styles.modeSwitchBtn}
                    onClick={handleBackToLogin}
                  >
                    {auth.actions.signIn}
                  </button>
                </div>
              </form>
            )}

            {registerStep === 'email-verification' && (
              <div className={styles.verificationStep}>
                <div className={styles.verificationContent}>
                  <Icon name="mail" size="xl" />
                  <h3>{auth.register.emailTitle}</h3>
                  <p>{auth.register.emailDescription(email)} <strong>{email}</strong></p>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>{auth.fields.verificationCode}</label>
                    <input
                      type="text"
                      className={styles.verificationInput}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder={auth.fields.verificationPlaceholder}
                      maxLength={6}
                    />
                  </div>
                  <button
                    className={styles.submitBtn}
                    onClick={handleRegisterNext}
                    disabled={verificationCode.length !== 6}
                  >
                    {auth.actions.verifyEmail}
                  </button>
                  <button
                    type="button"
                    className={styles.resendButton}
                    onClick={async () => {
                      const result = await resendVerification(email.trim(), captchaToken);
                      if (!result.success) {
                        setError(result.error || auth.errors.unableToResendCode);
                        return;
                      }
                      if (result.devVerificationCode) {
                        setVerificationCode(result.devVerificationCode);
                      }
                      setError(null);
                    }}
                  >
                    {auth.actions.resendCode}
                  </button>
                </div>
              </div>
            )}

            {registerStep === 'security-setup' && (
              <div className={styles.securityStep}>
                <div className={styles.securityHeader}>
                  <Icon name="smartphone" size="lg" />
                  <h3>{auth.register.twoFactorTitle}</h3>
                  <p>{auth.register.twoFactorDescription}</p>
                </div>
                <div className={styles.twoFactorSetup}>
                  {setupQrCode ? (
                    <div className={styles.qrCard}>
                      <img src={setupQrCode} alt="Two-factor setup QR code" className={styles.qrImage} />
                      <p>{auth.register.qrDescription}</p>
                      {setupSecret && <span className={styles.secretText}>Manual key: {setupSecret}</span>}
                    </div>
                  ) : (
                    <div className={styles.qrPlaceholder}>
                      <Icon name="qr-code" size="xl" />
                      <p>{auth.register.qrPreparing}</p>
                    </div>
                  )}
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>{auth.fields.authenticatorCode}</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder={auth.fields.authenticatorPlaceholder}
                      maxLength={6}
                    />
                  </div>
                  <div className={styles.securityOptions}>
                    <label className={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={twoFactorEnabled}
                        onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                      />
                      <span>{auth.register.enable2FA}</span>
                    </label>
                  </div>
                  <button
                    className={styles.submitBtn}
                    onClick={handleRegisterNext}
                  >
                    {auth.actions.completeSetup}
                  </button>
                </div>
              </div>
            )}

            {registerStep === 'complete' && (
              <div className={styles.successStep}>
                <div className={styles.successContent}>
                  <Icon name="check-circle" size="xl" className={styles.successIcon} />
                  <h3>{auth.register.successTitle}</h3>
                  <p>{auth.register.successDescription}</p>
                  <p className={styles.successNote}>{auth.register.redirecting}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Forgot Password Form */}
        {mode === 'forgot-password' && (
          <div className={styles.forgotPasswordContainer}>
            <div className={styles.forgotPasswordContent}>
              <Icon name="key" size="xl" />
              <h3>{auth.forgotPassword.title}</h3>
              <p>{auth.forgotPassword.description}</p>
              <div className={styles.inputGroup}>
                <label className={styles.label}>{auth.fields.email}</label>
                <div className={styles.inputWrapper}>
                  <Icon name="mail" size="sm" className={styles.inputIcon} />
                  <input
                    type="email"
                    className={styles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={auth.fields.emailPlaceholder}
                    required
                  />
                </div>
              </div>
              {!passwordResetRequested ? (
                <button
                  className={styles.submitBtn}
                  onClick={handleForgotPassword}
                  disabled={!captchaToken}
                >
                  {auth.actions.sendResetCode}
                </button>
              ) : (
                <>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>{auth.fields.resetCode}</label>
                    <div className={styles.inputWrapper}>
                      <Icon name="shield-check" size="sm" className={styles.inputIcon} />
                      <input
                        type="text"
                        className={styles.input}
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder={auth.fields.resetCodePlaceholder}
                        inputMode="numeric"
                        maxLength={6}
                      />
                    </div>
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>{auth.fields.newPassword}</label>
                    <PasswordField
                      id="reset-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={auth.fields.newPasswordPlaceholder}
                      autoComplete="new-password"
                      showStrength
                      strength={calculatePasswordStrength(newPassword)}
                      strengthLabel={getPasswordStrengthLabel(calculatePasswordStrength(newPassword))}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>{auth.fields.confirmNewPassword}</label>
                    <div className={styles.inputWrapper}>
                      <Icon name="lock" size="sm" className={styles.inputIcon} />
                      <input
                        type="password"
                        className={styles.input}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder={auth.fields.confirmNewPasswordPlaceholder}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <button
                    className={styles.submitBtn}
                    onClick={handleResetPassword}
                  >
                    {auth.actions.resetPassword}
                  </button>
                </>
              )}

              <div className={styles.captchaContainer}>
                <div className={styles.secureLoginHeader}>
                  <Icon name="shield-check" size="sm" />
                  <span>{auth.secure.reset}</span>
                </div>
                <GoogleRecaptcha
                  siteKey={recaptchaSiteKey || ''}
                  onToken={setCaptchaToken}
                  onExpired={() => setCaptchaToken('')}
                  onError={() => setCaptchaToken('')}
                  className={styles.recaptchaBox}
                />
              </div>
              <button
                type="button"
                className={styles.backButton}
                onClick={() => setMode('login')}
              >
                {auth.actions.backToLogin}
              </button>
            </div>
          </div>
        )}

        {/* Login Activity Panel */}
        {loginActivity.length > 0 && (
          <div className={styles.activityPanel}>
            <div className={styles.activityHeader}>
              <Icon name="activity" size="sm" />
              <span>{auth.activity.title}</span>
            </div>
            <div className={styles.activityList}>
              {loginActivity.slice(0, 3).map((activity) => (
                <div key={activity.id} className={styles.activityItem}>
                  <div className={`${styles.activityDot} ${activity.status === 'success' ? styles.success : styles.failed}`} />
                  <div className={styles.activityInfo}>
                    <span className={styles.activityDevice}>{activity.device}</span>
                    <span className={styles.activityTime}>
                      {activity.timestamp.toLocaleString(getUiLocale())}
                    </span>
                  </div>
                  <span className={`${styles.activityStatus} ${activity.status}`}>
                    {activity.status === 'success' ? auth.activity.status.success : auth.activity.status.failed}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Footer - Desktop */}
        {!isMobile && (
          <div className={styles.footer}>
            <div className={styles.securityBadges}>
              <div className={styles.badge}>
                <Icon name="shield-check" size="xs" />
                <span>{auth.badges.sslSecure}</span>
              </div>
              <div className={styles.badge}>
                <Icon name="lock" size="xs" />
                <span>{auth.badges.twoFaReady}</span>
              </div>
            </div>
            
            <div className={styles.systemStatus}>
              <div className={styles.statusHeader}>
                <Icon name="activity" size="xs" />
                <span>{auth.engineStatus.title}</span>
              </div>
              <div className={styles.statusGrid}>
                <div className={styles.statusItem}>
                  <span className={`${styles.dot} ${styles[systemCheck.ws]}`} />
                  <div className={styles.statusInfo}>
                    <span className={styles.statusLabel}>{auth.engineStatus.websocket}</span>
                    <span className={styles.statusValue}>{systemCheck.ws === 'ok' ? auth.engineStatus.connected : auth.engineStatus.loading}</span>
                  </div>
                </div>
                <div className={styles.statusItem}>
                  <span className={`${styles.dot} ${styles[systemCheck.engine]}`} />
                  <div className={styles.statusInfo}>
                    <span className={styles.statusLabel}>{auth.engineStatus.matching}</span>
                    <span className={styles.statusValue}>{systemCheck.engine === 'ok' ? auth.engineStatus.active : auth.engineStatus.loading}</span>
                  </div>
                </div>
                <div className={styles.statusItem}>
                  <span className={`${styles.dot} ${styles[systemCheck.security]}`} />
                  <div className={styles.statusInfo}>
                    <span className={styles.statusLabel}>{auth.engineStatus.security}</span>
                    <span className={styles.statusValue}>{systemCheck.security === 'ok' ? auth.engineStatus.active : auth.engineStatus.loading}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Footer - Compact System Status & Security */}
        {isMobile && (
          <div className={styles.mobileFooter}>
            <div className={styles.mobileSystemStatus}>
              <div className={styles.mobileStatusItem}>
                <span className={`${styles.mobileStatusDot} ${systemCheck.ws === 'ok' ? styles.ok : systemCheck.ws === 'pending' ? styles.pending : ''}`} />
                <span>{auth.engineStatus.websocket}</span>
              </div>
              <div className={styles.mobileStatusItem}>
                <span className={`${styles.mobileStatusDot} ${systemCheck.engine === 'ok' ? styles.ok : systemCheck.engine === 'pending' ? styles.pending : ''}`} />
                <span>{auth.engineStatus.matching}</span>
              </div>
              <div className={styles.mobileStatusItem}>
                <span className={`${styles.mobileStatusDot} ${systemCheck.security === 'ok' ? styles.ok : systemCheck.security === 'pending' ? styles.pending : ''}`} />
                <span>{auth.engineStatus.security}</span>
              </div>
            </div>
            <div className={styles.mobileSecurityBadges}>
              <div className={styles.mobileSecurityBadge}>
                <Icon name="shield-check" size="xs" />
                <span>SSL</span>
              </div>
              <div className={styles.mobileSecurityBadge}>
                <Icon name="lock" size="xs" />
                <span>2FA</span>
              </div>
            </div>
            {/* Mobile Language Toggle Only */}
            <div className={styles.mobileLanguageToggle}>
              <LanguageToggle />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
