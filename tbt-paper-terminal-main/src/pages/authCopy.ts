import type { LocaleKey } from '../i18n';

export interface AuthCopy {
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
    selectCountry: string;
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
    newTo: string;
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
    location: string;
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
  errors: {
    emailRequired: string;
    usernameRequired: string;
    passwordRequired: string;
    weakPassword: string;
    passwordsMismatch: string;
    countryRequired: string;
    captchaRequired: string;
    authenticatorRequired: string;
    verificationRequired: string;
    loginTwoFactorRequired: string;
    loginFailed: string;
    registrationFailed: string;
    verificationFailed: string;
    twoFactorSetupFailed: string;
    startTwoFactorFailed: string;
    passwordResetRequestFailed: string;
    enterEmailAddress: string;
    resetCodeRequired: string;
    passwordTooShort: string;
    passwordResetFailed: string;
    passwordUpdatedSuccess: string;
    unableToResendCode: string;
  };
}

const BASE: AuthCopy = {
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
    selectCountry: 'Select your country',
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
    newTo: 'New to Apexora?',
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
    location: 'Current Location',
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
  errors: {
    emailRequired: 'Email is required',
    usernameRequired: 'Username is required',
    passwordRequired: 'Password is required',
    weakPassword: 'Password is too weak. Please choose a stronger password.',
    passwordsMismatch: 'Passwords do not match',
    countryRequired: 'Please select your country',
    captchaRequired: 'Please complete the secure CAPTCHA verification',
    authenticatorRequired: 'Enter the 6-digit authenticator code',
    verificationRequired: 'Please enter a valid 6-digit verification code',
    loginTwoFactorRequired: 'Two-factor verification is required',
    loginFailed: 'Login failed',
    registrationFailed: 'Registration failed',
    verificationFailed: 'Verification failed',
    twoFactorSetupFailed: 'Two-factor setup failed',
    startTwoFactorFailed: 'Unable to start two-factor setup',
    passwordResetRequestFailed: 'Password reset request failed',
    enterEmailAddress: 'Please enter your email address',
    resetCodeRequired: 'Enter the 6-digit reset code',
    passwordTooShort: 'Password must be at least 10 characters',
    passwordResetFailed: 'Password reset failed',
    passwordUpdatedSuccess: 'Password updated successfully. You can sign in now.',
    unableToResendCode: 'Unable to resend code',
  },
};

const OVERRIDES: Partial<Record<LocaleKey, Partial<AuthCopy>>> = {
  'zh-CN': {
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
      selectCountry: '选择国家/地区',
      authenticatorCode: '验证器代码',
      verificationCode: '验证码',
      resetCode: '重置码',
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
      newTo: 'APEXORA 新用户？',
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
      location: '当前位置',
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
    errors: {
      emailRequired: '请输入邮箱',
      usernameRequired: '请输入用户名',
      passwordRequired: '请输入密码',
      weakPassword: '密码强度太低，请使用更强的密码。',
      passwordsMismatch: '两次输入的密码不一致',
      countryRequired: '请选择国家/地区',
      captchaRequired: '请完成安全验证码验证',
      authenticatorRequired: '请输入 6 位验证器代码',
      verificationRequired: '请输入有效的 6 位验证码',
      loginTwoFactorRequired: '需要双重验证',
      loginFailed: '登录失败',
      registrationFailed: '注册失败',
      verificationFailed: '验证失败',
      twoFactorSetupFailed: '双重验证设置失败',
      startTwoFactorFailed: '无法开始双重验证设置',
      passwordResetRequestFailed: '重置密码请求失败',
      enterEmailAddress: '请输入邮箱地址',
      resetCodeRequired: '请输入 6 位重置码',
      passwordTooShort: '密码长度至少需要 10 个字符',
      passwordResetFailed: '密码重置失败',
      passwordUpdatedSuccess: '密码已成功更新，现在可以登录。',
      unableToResendCode: '无法重新发送验证码',
    },
  },
  'ja-JP': {
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
      selectCountry: '国を選択',
      authenticatorCode: '認証コード',
      verificationCode: '確認コード',
      resetCode: '再設定コード',
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
      newTo: 'APEXORA はじめてですか？',
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
      location: '現在地',
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
  'es-ES': {
    subtitle: {
      login: 'Bienvenido de nuevo',
      registerAccount: 'Crear cuenta',
      registerVerifyEmail: 'Verificar correo',
      registerSecuritySetup: 'Configuración de seguridad',
      registerComplete: 'Cuenta creada',
      forgotPassword: 'Restablecer contraseña',
    },
    newDevice: {
      title: 'Nuevo dispositivo detectado',
      description: 'Hemos detectado un inicio de sesión desde un dispositivo nuevo. Por seguridad, enviamos un código de verificación a tu correo.',
      dismiss: 'Cerrar',
    },
    fields: {
      email: 'Correo electrónico',
      emailPlaceholder: 'Ingresa tu correo',
      username: 'Nombre de usuario',
      usernamePlaceholder: 'Elige un nombre de usuario',
      password: 'Contraseña',
      passwordPlaceholder: 'Ingresa tu contraseña',
      confirmPassword: 'Confirmar contraseña',
      confirmPasswordPlaceholder: 'Confirma tu contraseña',
      country: 'País',
      selectCountry: 'Selecciona tu país',
      authenticatorCode: 'Código del autenticador',
      verificationCode: 'Código de verificación',
      resetCode: 'Código de restablecimiento',
      newPassword: 'Nueva contraseña',
      newPasswordPlaceholder: 'Crea una nueva contraseña',
      confirmNewPassword: 'Confirmar nueva contraseña',
      confirmNewPasswordPlaceholder: 'Confirma la nueva contraseña',
    },
    actions: {
      rememberMe: 'Recuérdame',
      forgotPassword: '¿Olvidaste tu contraseña?',
      signIn: 'Iniciar sesión',
      verifyAndSignIn: 'Verificar e iniciar sesión',
      createAccount: 'Crear cuenta',
      continueSecurely: 'Continuar de forma segura',
      verifyEmail: 'Verificar correo',
      resendCode: 'Reenviar código',
      completeSetup: 'Completar configuración',
      sendResetCode: 'Enviar código',
      resetPassword: 'Restablecer contraseña',
      backToLogin: 'Volver al inicio',
      newTo: '¿Nuevo en Apexora?',
    },
    register: {
      alreadyHave: '¿Ya tienes una cuenta?',
      emailTitle: 'Verificación de correo',
      emailDescription: (email) => `Hemos enviado un código de verificación de 6 dígitos a ${email}`,
      twoFactorTitle: 'Autenticación de dos factores',
      twoFactorDescription: 'Agrega una capa extra de seguridad a tu cuenta. Este paso es opcional, pero recomendado.',
      qrDescription: 'Escanea este código QR con Google Authenticator u otra app TOTP.',
      qrPreparing: 'Preparando código QR seguro...',
      enable2FA: 'Activar 2FA para mayor seguridad',
      successTitle: '¡Cuenta creada con éxito!',
      successDescription: 'Bienvenido a Apexora. Tu cuenta se ha creado y protegido.',
      redirecting: 'Redirigiendo al inicio...',
    },
    forgotPassword: {
      title: 'Restablece tu contraseña',
      description: 'Ingresa tu correo electrónico y te enviaremos un código de restablecimiento seguro.',
    },
    activity: {
      title: 'Actividad reciente de inicio de sesión',
      location: 'Ubicación actual',
      status: {
        success: 'éxito',
        failed: 'fallido',
      },
    },
    badges: {
      sslSecure: 'SSL SEGURO',
      twoFaReady: '2FA LISTO',
    },
    engineStatus: {
      title: 'Estado del motor en tiempo real',
      websocket: 'WebSocket',
      matching: 'Coincidencia',
      security: 'Seguridad',
      connected: 'Conectado',
      active: 'Activo',
      loading: '...',
    },
    strength: {
      veryWeak: 'Muy débil',
      weak: 'Débil',
      good: 'Bueno',
      strong: 'Fuerte',
      veryStrong: 'Muy fuerte',
    },
  },
  'fr-FR': {
    subtitle: {
      login: 'Bon retour',
      registerAccount: 'Créer un compte',
      registerVerifyEmail: 'Vérifier l’email',
      registerSecuritySetup: 'Configuration de sécurité',
      registerComplete: 'Compte créé',
      forgotPassword: 'Réinitialiser le mot de passe',
    },
    newDevice: {
      title: 'Nouvel appareil détecté',
      description: 'Nous avons détecté une connexion depuis un nouvel appareil. Par sécurité, un code de vérification a été envoyé à votre email.',
      dismiss: 'Fermer',
    },
    fields: {
      email: 'Adresse email',
      emailPlaceholder: 'Saisissez votre email',
      username: 'Nom d’utilisateur',
      usernamePlaceholder: 'Choisissez un nom d’utilisateur',
      password: 'Mot de passe',
      passwordPlaceholder: 'Saisissez votre mot de passe',
      confirmPassword: 'Confirmer le mot de passe',
      confirmPasswordPlaceholder: 'Confirmez votre mot de passe',
      country: 'Pays',
      selectCountry: 'Sélectionnez votre pays',
      authenticatorCode: 'Code d’authentification',
      verificationCode: 'Code de vérification',
      resetCode: 'Code de réinitialisation',
      newPassword: 'Nouveau mot de passe',
      newPasswordPlaceholder: 'Créez un nouveau mot de passe',
      confirmNewPassword: 'Confirmer le nouveau mot de passe',
      confirmNewPasswordPlaceholder: 'Confirmez le nouveau mot de passe',
    },
    actions: {
      rememberMe: 'Se souvenir de moi',
      forgotPassword: 'Mot de passe oublié ?',
      signIn: 'Se connecter',
      verifyAndSignIn: 'Vérifier et se connecter',
      createAccount: 'Créer un compte',
      continueSecurely: 'Continuer en toute sécurité',
      verifyEmail: 'Vérifier l’email',
      resendCode: 'Renvoyer le code',
      completeSetup: 'Terminer la configuration',
      sendResetCode: 'Envoyer le code',
      resetPassword: 'Réinitialiser le mot de passe',
      backToLogin: 'Retour à la connexion',
      newTo: 'Nouveau sur Apexora ?',
    },
    register: {
      alreadyHave: 'Vous avez déjà un compte ?',
      emailTitle: 'Vérification de l’email',
      emailDescription: (email) => `Nous avons envoyé un code de vérification à 6 chiffres à ${email}`,
      twoFactorTitle: 'Authentification à deux facteurs',
      twoFactorDescription: 'Ajoutez une couche supplémentaire de sécurité à votre compte. Cette étape est facultative mais recommandée.',
      qrDescription: 'Scannez ce code QR avec Google Authenticator ou une autre application TOTP.',
      qrPreparing: 'Préparation du code QR sécurisé...',
      enable2FA: 'Activer la 2FA pour plus de sécurité',
      successTitle: 'Compte créé avec succès !',
      successDescription: 'Bienvenue sur Apexora. Votre compte a été créé et sécurisé.',
      redirecting: 'Redirection vers la connexion...',
    },
    forgotPassword: {
      title: 'Réinitialiser votre mot de passe',
      description: 'Saisissez votre adresse email et nous enverrons un code de réinitialisation sécurisé.',
    },
    activity: {
      title: 'Activité de connexion récente',
      location: 'Emplacement actuel',
      status: {
        success: 'succès',
        failed: 'échec',
      },
    },
    badges: {
      sslSecure: 'SSL SÉCURISÉ',
      twoFaReady: '2FA PRÊT',
    },
    engineStatus: {
      title: 'État du moteur en temps réel',
      websocket: 'WebSocket',
      matching: 'Appariement',
      security: 'Sécurité',
      connected: 'Connecté',
      active: 'Actif',
      loading: '...',
    },
    strength: {
      veryWeak: 'Très faible',
      weak: 'Faible',
      good: 'Bon',
      strong: 'Fort',
      veryStrong: 'Très fort',
    },
  },
  'ko-KR': {
    subtitle: {
      login: '다시 오신 것을 환영합니다',
      registerAccount: '계정 만들기',
      registerVerifyEmail: '이메일 인증',
      registerSecuritySetup: '보안 설정',
      registerComplete: '계정 생성 완료',
      forgotPassword: '비밀번호 재설정',
    },
    newDevice: {
      title: '새 기기 감지됨',
      description: '새 기기에서 로그인한 것이 감지되었습니다. 보안을 위해 이메일로 인증 코드를 보냈습니다.',
      dismiss: '닫기',
    },
    fields: {
      email: '이메일 주소',
      emailPlaceholder: '이메일을 입력하세요',
      username: '사용자 이름',
      usernamePlaceholder: '사용자 이름을 선택하세요',
      password: '비밀번호',
      passwordPlaceholder: '비밀번호를 입력하세요',
      confirmPassword: '비밀번호 확인',
      confirmPasswordPlaceholder: '비밀번호를 다시 입력하세요',
      country: '국가',
      selectCountry: '국가를 선택하세요',
      authenticatorCode: '인증 코드',
      verificationCode: '인증 확인 코드',
      resetCode: '재설정 코드',
      newPassword: '새 비밀번호',
      newPasswordPlaceholder: '새 비밀번호를 만드세요',
      confirmNewPassword: '새 비밀번호 확인',
      confirmNewPasswordPlaceholder: '새 비밀번호를 다시 입력하세요',
    },
    actions: {
      rememberMe: '로그인 상태 유지',
      forgotPassword: '비밀번호를 잊으셨나요?',
      signIn: '로그인',
      verifyAndSignIn: '확인 후 로그인',
      createAccount: '계정 만들기',
      continueSecurely: '안전하게 계속',
      verifyEmail: '이메일 인증',
      resendCode: '코드 재전송',
      completeSetup: '설정 완료',
      sendResetCode: '재설정 코드 보내기',
      resetPassword: '비밀번호 재설정',
      backToLogin: '로그인으로 돌아가기',
      newTo: 'Apexora가 처음이신가요?',
    },
    register: {
      alreadyHave: '이미 계정이 있으신가요?',
      emailTitle: '이메일 인증',
      emailDescription: (email) => `${email}로 6자리 인증 코드를 보냈습니다`,
      twoFactorTitle: '2단계 인증',
      twoFactorDescription: '계정에 추가 보안을 더합니다. 선택 사항이지만 권장합니다.',
      qrDescription: 'Google Authenticator 또는 다른 TOTP 앱으로 이 QR 코드를 스캔하세요.',
      qrPreparing: '보안 QR 코드 준비 중...',
      enable2FA: '보안을 강화하기 위해 2FA 사용',
      successTitle: '계정이 성공적으로 생성되었습니다!',
      successDescription: 'Apexora에 오신 것을 환영합니다. 계정이 생성되고 보호되었습니다.',
      redirecting: '로그인으로 이동 중...',
    },
    forgotPassword: {
      title: '비밀번호 재설정',
      description: '이메일 주소를 입력하면 안전한 재설정 코드를 보내드립니다.',
    },
    activity: {
      title: '최근 로그인 활동',
      location: '현재 위치',
      status: {
        success: '성공',
        failed: '실패',
      },
    },
    badges: {
      sslSecure: 'SSL 보안',
      twoFaReady: '2FA 준비됨',
    },
    engineStatus: {
      title: '실시간 엔진 상태',
      websocket: 'WebSocket',
      matching: '매칭',
      security: '보안',
      connected: '연결됨',
      active: '활성',
      loading: '...',
    },
    strength: {
      veryWeak: '매우 약함',
      weak: '약함',
      good: '보통',
      strong: '강함',
      veryStrong: '매우 강함',
    },
  },
  'pt-BR': {
    subtitle: {
      login: 'Bem-vindo de volta',
      registerAccount: 'Criar conta',
      registerVerifyEmail: 'Verificar email',
      registerSecuritySetup: 'Configuração de segurança',
      registerComplete: 'Conta criada',
      forgotPassword: 'Redefinir senha',
    },
    newDevice: {
      title: 'Novo dispositivo detectado',
      description: 'Detectamos um login a partir de um dispositivo novo. Por segurança, enviamos um código de verificação para o seu email.',
      dismiss: 'Fechar',
    },
    fields: {
      email: 'Endereço de email',
      emailPlaceholder: 'Digite seu email',
      username: 'Nome de usuário',
      usernamePlaceholder: 'Escolha um nome de usuário',
      password: 'Senha',
      passwordPlaceholder: 'Digite sua senha',
      confirmPassword: 'Confirmar senha',
      confirmPasswordPlaceholder: 'Confirme sua senha',
      country: 'País',
      selectCountry: 'Selecione seu país',
      authenticatorCode: 'Código do autenticador',
      verificationCode: 'Código de verificação',
      resetCode: 'Código de redefinição',
      newPassword: 'Nova senha',
      newPasswordPlaceholder: 'Crie uma nova senha',
      confirmNewPassword: 'Confirmar nova senha',
      confirmNewPasswordPlaceholder: 'Confirme a nova senha',
    },
    actions: {
      rememberMe: 'Lembrar de mim',
      forgotPassword: 'Esqueceu a senha?',
      signIn: 'Entrar',
      verifyAndSignIn: 'Verificar e entrar',
      createAccount: 'Criar conta',
      continueSecurely: 'Continuar com segurança',
      verifyEmail: 'Verificar email',
      resendCode: 'Reenviar código',
      completeSetup: 'Concluir configuração',
      sendResetCode: 'Enviar código',
      resetPassword: 'Redefinir senha',
      backToLogin: 'Voltar ao login',
      newTo: 'Novo na Apexora?',
    },
    register: {
      alreadyHave: 'Já tem uma conta?',
      emailTitle: 'Verificação de email',
      emailDescription: (email) => `Enviamos um código de verificação de 6 dígitos para ${email}`,
      twoFactorTitle: 'Autenticação de dois fatores',
      twoFactorDescription: 'Adicione uma camada extra de segurança à sua conta. Esta etapa é opcional, mas recomendada.',
      qrDescription: 'Escaneie este QR code com o Google Authenticator ou outro app TOTP.',
      qrPreparing: 'Preparando QR code seguro...',
      enable2FA: 'Ativar 2FA para mais segurança',
      successTitle: 'Conta criada com sucesso!',
      successDescription: 'Bem-vindo à Apexora. Sua conta foi criada e protegida.',
      redirecting: 'Redirecionando para o login...',
    },
    forgotPassword: {
      title: 'Redefina sua senha',
      description: 'Digite seu endereço de email e enviaremos um código de redefinição seguro.',
    },
    activity: {
      title: 'Atividade recente de login',
      location: 'Local atual',
      status: {
        success: 'sucesso',
        failed: 'falha',
      },
    },
    badges: {
      sslSecure: 'SSL SEGURO',
      twoFaReady: '2FA PRONTO',
    },
    engineStatus: {
      title: 'Status do motor em tempo real',
      websocket: 'WebSocket',
      matching: 'Matching',
      security: 'Segurança',
      connected: 'Conectado',
      active: 'Ativo',
      loading: '...',
    },
    strength: {
      veryWeak: 'Muito fraca',
      weak: 'Fraca',
      good: 'Boa',
      strong: 'Forte',
      veryStrong: 'Muito forte',
    },
  },
  'ar-SA': {
    subtitle: {
      login: 'مرحبًا بعودتك',
      registerAccount: 'إنشاء حساب',
      registerVerifyEmail: 'تأكيد البريد الإلكتروني',
      registerSecuritySetup: 'إعداد الأمان',
      registerComplete: 'تم إنشاء الحساب',
      forgotPassword: 'إعادة تعيين كلمة المرور',
    },
    newDevice: {
      title: 'تم اكتشاف جهاز جديد',
      description: 'لاحظنا أنك تسجّل الدخول من جهاز جديد. ولأمانك، أرسلنا رمز تحقق إلى بريدك الإلكتروني.',
      dismiss: 'إغلاق',
    },
    fields: {
      email: 'البريد الإلكتروني',
      emailPlaceholder: 'أدخل بريدك الإلكتروني',
      username: 'اسم المستخدم',
      usernamePlaceholder: 'اختر اسم مستخدم',
      password: 'كلمة المرور',
      passwordPlaceholder: 'أدخل كلمة المرور',
      confirmPassword: 'تأكيد كلمة المرور',
      confirmPasswordPlaceholder: 'أعد إدخال كلمة المرور',
      country: 'الدولة',
      selectCountry: 'اختر دولتك',
      authenticatorCode: 'رمز المصادقة',
      verificationCode: 'رمز التحقق',
      resetCode: 'رمز إعادة التعيين',
      newPassword: 'كلمة مرور جديدة',
      newPasswordPlaceholder: 'أنشئ كلمة مرور جديدة',
      confirmNewPassword: 'تأكيد كلمة المرور الجديدة',
      confirmNewPasswordPlaceholder: 'أعد إدخال كلمة المرور الجديدة',
    },
    actions: {
      rememberMe: 'تذكرني',
      forgotPassword: 'هل نسيت كلمة المرور؟',
      signIn: 'تسجيل الدخول',
      verifyAndSignIn: 'تحقق وسجّل الدخول',
      createAccount: 'إنشاء حساب',
      continueSecurely: 'المتابعة بأمان',
      verifyEmail: 'تأكيد البريد الإلكتروني',
      resendCode: 'إعادة إرسال الرمز',
      completeSetup: 'إكمال الإعداد',
      sendResetCode: 'إرسال رمز إعادة التعيين',
      resetPassword: 'إعادة تعيين كلمة المرور',
      backToLogin: 'العودة لتسجيل الدخول',
      newTo: 'جديد على Apexora؟',
    },
    register: {
      alreadyHave: 'هل لديك حساب بالفعل؟',
      emailTitle: 'تأكيد البريد الإلكتروني',
      emailDescription: (email) => `أرسلنا رمز تحقق مكوّنًا من 6 أرقام إلى ${email}`,
      twoFactorTitle: 'المصادقة الثنائية',
      twoFactorDescription: 'أضف طبقة أمان إضافية إلى حسابك. هذه الخطوة اختيارية لكن يُنصح بها.',
      qrDescription: 'امسح رمز QR هذا باستخدام Google Authenticator أو أي تطبيق TOTP آخر.',
      qrPreparing: 'جارٍ تجهيز رمز QR الآمن...',
      enable2FA: 'تفعيل 2FA لمزيد من الأمان',
      successTitle: 'تم إنشاء الحساب بنجاح!',
      successDescription: 'مرحبًا بك في Apexora. تم إنشاء حسابك وتأمينه.',
      redirecting: 'جارٍ التوجيه إلى تسجيل الدخول...',
    },
    forgotPassword: {
      title: 'إعادة تعيين كلمة المرور',
      description: 'أدخل بريدك الإلكتروني وسنرسل رمز إعادة تعيين آمن.',
    },
    activity: {
      title: 'نشاط تسجيل الدخول الأخير',
      location: 'الموقع الحالي',
      status: {
        success: 'نجاح',
        failed: 'فشل',
      },
    },
    badges: {
      sslSecure: 'SSL آمن',
      twoFaReady: '2FA جاهز',
    },
    engineStatus: {
      title: 'حالة المحرك في الوقت الحقيقي',
      websocket: 'WebSocket',
      matching: 'المطابقة',
      security: 'الأمان',
      connected: 'متصل',
      active: 'نشط',
      loading: '...',
    },
    strength: {
      veryWeak: 'ضعيف جدًا',
      weak: 'ضعيف',
      good: 'جيد',
      strong: 'قوي',
      veryStrong: 'قوي جدًا',
    },
  },
};

export const getAuthCopy = (locale: LocaleKey): AuthCopy => ({
  ...BASE,
  ...(OVERRIDES[locale] ?? {}),
  subtitle: { ...BASE.subtitle, ...(OVERRIDES[locale]?.subtitle ?? {}) },
  newDevice: { ...BASE.newDevice, ...(OVERRIDES[locale]?.newDevice ?? {}) },
  fields: { ...BASE.fields, ...(OVERRIDES[locale]?.fields ?? {}) },
  actions: { ...BASE.actions, ...(OVERRIDES[locale]?.actions ?? {}) },
  secure: { ...BASE.secure, ...(OVERRIDES[locale]?.secure ?? {}) },
  register: { ...BASE.register, ...(OVERRIDES[locale]?.register ?? {}) },
  forgotPassword: { ...BASE.forgotPassword, ...(OVERRIDES[locale]?.forgotPassword ?? {}) },
  activity: { ...BASE.activity, ...(OVERRIDES[locale]?.activity ?? {}) },
  badges: { ...BASE.badges, ...(OVERRIDES[locale]?.badges ?? {}) },
  engineStatus: { ...BASE.engineStatus, ...(OVERRIDES[locale]?.engineStatus ?? {}) },
  strength: { ...BASE.strength, ...(OVERRIDES[locale]?.strength ?? {}) },
  errors: { ...BASE.errors, ...(OVERRIDES[locale]?.errors ?? {}) },
});
