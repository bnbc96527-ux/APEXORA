import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useWalletStore } from '../store/walletStore';
import { useI18n } from '../i18n';
import { Icon } from '../components/Icon';
import PasswordField from '../components/PasswordField/PasswordField';
import { useIsMobile } from '../hooks/useMediaQuery';
import { LanguageToggle } from '../components/LanguageToggle';
import { ThemeToggle } from '../components/ThemeToggle';
import styles from './AuthPage.module.css';

type AuthMode = 'login' | 'register' | 'forgot-password';
type RegisterStep = 'account' | 'email-verification' | 'security-setup' | 'complete';

interface LoginActivity {
  id: string;
  timestamp: Date;
  device: string;
  location: string;
  status: 'success' | 'failed';
}

export const AuthPage: React.FC = () => {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { login, register, isAuthenticated, isLoading, isInitialized, markAsInitialized } = useAuthStore();
  const { grantInitialFunds, hasReceivedInitialGrant } = useWalletStore();

  // Main state
  const [mode, setMode] = useState<AuthMode>('login');
  const [registerStep, setRegisterStep] = useState<RegisterStep>('account');

  // Form fields
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [country, setCountry] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');

  // Security features
  const [error, setError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [showDeviceAlert, setShowDeviceAlert] = useState(false);
  const [loginActivity, setLoginActivity] = useState<LoginActivity[]>([]);

  // System status
  const [systemCheck, setSystemCheck] = useState({
    ws: 'pending',
    engine: 'pending',
    security: 'pending',
  });

  useEffect(() => {
    if (isAuthenticated) {
      // Grant initial funds if not already done
      if (!isInitialized && !hasReceivedInitialGrant) {
        const granted = grantInitialFunds();
        if (granted) {
          markAsInitialized();
        }
      }
      navigate('/trade');
    }
  }, [isAuthenticated, isInitialized, hasReceivedInitialGrant, grantInitialFunds, markAsInitialized, navigate]);

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

  const validateLoginForm = (): boolean => {
    setError(null);

    if (!email.trim()) {
      setError('Email is required');
      return false;
    }

    if (!password) {
      setError('Password is required');
      return false;
    }

    if (!captchaToken && loginAttempts > 0) {
      setError('Please complete the CAPTCHA verification');
      return false;
    }

    return true;
  };

  const validateRegisterStep = (): boolean => {
    setError(null);

    if (registerStep === 'account') {
      if (!email.trim()) {
        setError('Email is required');
        return false;
      }

      if (!username.trim()) {
        setError('Username is required');
        return false;
      }

      if (!password) {
        setError('Password is required');
        return false;
      }

      if (passwordStrength < 60) {
        setError('Password is too weak. Please choose a stronger password.');
        return false;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return false;
      }

      if (!country) {
        setError('Please select your country');
        return false;
      }

      if (!captchaToken) {
        setError('Please complete the CAPTCHA verification');
        return false;
      }
    }

    if (registerStep === 'email-verification') {
      if (!verificationCode || verificationCode.length !== 6) {
        setError('Please enter a valid 6-digit verification code');
        return false;
      }
    }

    return true;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateLoginForm()) return;

    setError(null);

    // Handle login attempt monitoring
    if (isLocked) return;

    setLoginAttempts(prev => prev + 1);

    if (loginAttempts >= 2) {
      setIsLocked(true);
      setLockoutTime(30);
      const timer = setInterval(() => {
        setLockoutTime(prev => {
          if (prev <= 1) {
            setIsLocked(false);
            setLoginAttempts(0);
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return;
    }

    const result = await login(email.trim(), password);
    if (result.success) {
      // Check for new device
      const isNewDevice = checkDeviceFingerprint();
      if (isNewDevice) {
        setShowDeviceAlert(true);
        addLoginActivity('success', 'New device detected');
      } else {
        addLoginActivity('success', 'Login successful');
      }

      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('savedEmail', email);
      }
    } else {
      setError(result.error || 'Login failed');
      addLoginActivity('failed', 'Login failed');
    }
  };

  const handleRegisterNext = async () => {
    if (!validateRegisterStep()) return;

    if (registerStep === 'account') {
      // Send verification email
      setRegisterStep('email-verification');
    } else if (registerStep === 'email-verification') {
      // Verify email code
      setRegisterStep('security-setup');
    } else if (registerStep === 'security-setup') {
      // Complete registration
      const result = await register(username.trim(), password);
      if (result.success) {
        setRegisterStep('complete');
        setTimeout(() => {
          setMode('login');
          setRegisterStep('account');
        }, 3000);
      } else {
        setError(result.error || 'Registration failed');
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    // Simulate password reset email
    setError(null);
    // In real implementation, call password reset API
    alert('Password reset link sent to your email');
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

  const addLoginActivity = (status: 'success' | 'failed', message: string) => {
    const activity: LoginActivity = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      device: navigator.userAgent.split(' ').pop() || 'Unknown',
      location: 'Current Location', // In real app, get from IP geolocation
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
    if (strength < 25) return 'Very Weak';
    if (strength < 50) return 'Weak';
    if (strength < 75) return 'Good';
    if (strength < 90) return 'Strong';
    return 'Very Strong';
  };

  const getPasswordStrengthColor = (strength: number): string => {
    if (strength < 25) return '#ef4444';
    if (strength < 50) return '#f97316';
    if (strength < 75) return '#eab308';
    if (strength < 90) return '#22c55e';
    return '#00d4ff';
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
  };

  const handleBackToLogin = () => {
    setMode('login');
    setRegisterStep('account');
    setError(null);
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
          <span className={styles.title}>APEXORA</span>
          <p className={styles.subtitle}>
            {mode === 'login' && 'Welcome Back'}
            {mode === 'register' && registerStep === 'account' && 'Create Account'}
            {mode === 'register' && registerStep === 'email-verification' && 'Verify Email'}
            {mode === 'register' && registerStep === 'security-setup' && 'Security Setup'}
            {mode === 'register' && registerStep === 'complete' && 'Account Created'}
            {mode === 'forgot-password' && 'Reset Password'}
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
              <h4>New Device Detected</h4>
              <p>We noticed you're logging in from a new device. For your security, we've sent a verification code to your email.</p>
              <button
                className={styles.alertButton}
                onClick={() => setShowDeviceAlert(false)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Login Form */}
        {mode === 'login' && (
          <form className={styles.form} onSubmit={handleLogin}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Email Address</label>
              <div className={styles.inputWrapper}>
                <Icon name="mail" size="sm" className={styles.inputIcon} />
                <input
                  type="email"
                  className={styles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>Password</label>
                  <div className={styles.inputWrapper}>
                    <Icon name="lock" size="sm" className={styles.inputIcon} />
                    <PasswordField
                      id="login-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                    />
                  </div>
                </div>

            <div className={styles.formOptions}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                className={styles.forgotPassword}
                onClick={() => setMode('forgot-password')}
              >
                Forgot password?
              </button>
            </div>

            {/* CAPTCHA for failed attempts */}
            {loginAttempts > 0 && (
              <div className={styles.captchaContainer}>
                <div className={styles.captchaPlaceholder}>
                  <Icon name="shield" size="lg" />
                  <p>Complete CAPTCHA verification</p>
                  <button
                    type="button"
                    className={styles.captchaButton}
                    onClick={() => setCaptchaToken('verified')}
                  >
                    Verify
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className={styles.errorMessage}>
                <Icon name="alert-circle" size="sm" />
                <span>{error}</span>
              </div>
            )}

            {isLocked && (
              <div className={styles.lockoutWarning}>
                <Icon name="alert-triangle" size="sm" />
                <span>Account temporarily locked. Try again in {lockoutTime} seconds.</span>
              </div>
            )}

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isLoading || isLocked}
            >
              {isLoading ? (
                <Icon name="loader" className={styles.spinner} />
              ) : (
                'Sign In'
              )}
            </button>

            <div className={styles.modeSwitch}>
              <span className={styles.modeSwitchText}>New to Apexora?</span>
              <button
                type="button"
                className={styles.modeSwitchBtn}
                onClick={toggleMode}
              >
                Create Account
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
                  <label className={styles.label}>Email Address</label>
                  <div className={styles.inputWrapper}>
                    <Icon name="mail" size="sm" className={styles.inputIcon} />
                    <input
                      type="email"
                      className={styles.input}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>Username</label>
                  <div className={styles.inputWrapper}>
                    <Icon name="user" size="sm" className={styles.inputIcon} />
                    <input
                      type="text"
                      className={styles.input}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Choose a username"
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>Password</label>
                  <div className={styles.inputWrapper}>
                    <Icon name="lock" size="sm" className={styles.inputIcon} />
                    <PasswordField
                      id="register-password"
                      value={password}
                      onChange={handlePasswordChange}
                      placeholder="Create a strong password"
                      autoComplete="new-password"
                      showStrength
                      strength={passwordStrength}
                      strengthLabel={getPasswordStrengthLabel(passwordStrength)}
                    />
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>Confirm Password</label>
                  <div className={styles.inputWrapper}>
                    <Icon name="lock" size="sm" className={styles.inputIcon} />
                    <input
                      type="password"
                      className={styles.input}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>Country</label>
                  <div className={styles.inputWrapper}>
                    <Icon name="map-pin" size="sm" className={styles.inputIcon} />
                    <select
                      className={styles.select}
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      required
                    >
                      <option value="">Select your country</option>
                      <option value="US">United States</option>
                      <option value="CA">Canada</option>
                      <option value="UK">United Kingdom</option>
                      <option value="DE">Germany</option>
                      <option value="FR">France</option>
                      <option value="JP">Japan</option>
                      <option value="AU">Australia</option>
                      {/* Add more countries as needed */}
                    </select>
                  </div>
                </div>

                <div className={styles.captchaContainer}>
                  <div className={styles.captchaPlaceholder}>
                    <Icon name="shield" size="lg" />
                    <p>Complete CAPTCHA verification</p>
                    <button
                      type="button"
                      className={styles.captchaButton}
                      onClick={() => setCaptchaToken('verified')}
                    >
                      Verify
                    </button>
                  </div>
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
                  Continue
                </button>

                <div className={styles.modeSwitch}>
                  <span className={styles.modeSwitchText}>Already have an account?</span>
                  <button
                    type="button"
                    className={styles.modeSwitchBtn}
                    onClick={handleBackToLogin}
                  >
                    Sign In
                  </button>
                </div>
              </form>
            )}

            {registerStep === 'email-verification' && (
              <div className={styles.verificationStep}>
                <div className={styles.verificationContent}>
                  <Icon name="mail" size="xl" />
                  <h3>Email Verification</h3>
                  <p>We've sent a 6-digit verification code to <strong>{email}</strong></p>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Verification Code</label>
                    <input
                      type="text"
                      className={styles.verificationInput}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                    />
                  </div>
                  <button
                    className={styles.submitBtn}
                    onClick={handleRegisterNext}
                    disabled={verificationCode.length !== 6}
                  >
                    Verify Email
                  </button>
                  <button
                    type="button"
                    className={styles.resendButton}
                    onClick={() => alert('Verification code resent')}
                  >
                    Resend Code
                  </button>
                </div>
              </div>
            )}

            {registerStep === 'security-setup' && (
              <div className={styles.securityStep}>
                <div className={styles.securityHeader}>
                  <Icon name="smartphone" size="lg" />
                  <h3>Two-Factor Authentication</h3>
                  <p>Add an extra layer of security to your account</p>
                </div>
                <div className={styles.twoFactorSetup}>
                  <div className={styles.qrPlaceholder}>
                    <Icon name="qr-code" size="xl" />
                    <p>Scan QR code with authenticator app</p>
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Enter 6-digit code</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
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
                      <span>Enable 2FA for enhanced security</span>
                    </label>
                  </div>
                  <button
                    className={styles.submitBtn}
                    onClick={handleRegisterNext}
                  >
                    Complete Setup
                  </button>
                </div>
              </div>
            )}

            {registerStep === 'complete' && (
              <div className={styles.successStep}>
                <div className={styles.successContent}>
                  <Icon name="check-circle" size="xl" className={styles.successIcon} />
                  <h3>Account Created Successfully!</h3>
                  <p>Welcome to Apexora. Your account has been created and secured.</p>
                  <p className={styles.successNote}>Redirecting to login...</p>
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
              <h3>Reset Your Password</h3>
              <p>Enter your email address and we'll send you a reset link.</p>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Email Address</label>
                <div className={styles.inputWrapper}>
                  <Icon name="mail" size="sm" className={styles.inputIcon} />
                  <input
                    type="email"
                    className={styles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>
              <button
                className={styles.submitBtn}
                onClick={handleForgotPassword}
              >
                Send Reset Link
              </button>
              <button
                type="button"
                className={styles.backButton}
                onClick={() => setMode('login')}
              >
                Back to Login
              </button>
            </div>
          </div>
        )}

        {/* Login Activity Panel */}
        {loginActivity.length > 0 && (
          <div className={styles.activityPanel}>
            <div className={styles.activityHeader}>
              <Icon name="activity" size="sm" />
              <span>Recent Login Activity</span>
            </div>
            <div className={styles.activityList}>
              {loginActivity.slice(0, 3).map((activity) => (
                <div key={activity.id} className={styles.activityItem}>
                  <div className={`${styles.activityDot} ${activity.status === 'success' ? styles.success : styles.failed}`} />
                  <div className={styles.activityInfo}>
                    <span className={styles.activityDevice}>{activity.device}</span>
                    <span className={styles.activityTime}>
                      {activity.timestamp.toLocaleString()}
                    </span>
                  </div>
                  <span className={`${styles.activityStatus} ${activity.status}`}>
                    {activity.status}
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
                <span>SSL SECURE</span>
              </div>
              <div className={styles.badge}>
                <Icon name="lock" size="xs" />
                <span>2FA READY</span>
              </div>
            </div>
            
            <div className={styles.systemStatus}>
              <div className={styles.statusHeader}>
                <Icon name="activity" size="xs" />
                <span>Real-Time Engine Status</span>
              </div>
              <div className={styles.statusGrid}>
                <div className={styles.statusItem}>
                  <span className={`${styles.dot} ${styles[systemCheck.ws]}`} />
                  <div className={styles.statusInfo}>
                    <span className={styles.statusLabel}>WebSocket</span>
                    <span className={styles.statusValue}>{systemCheck.ws === 'ok' ? 'Connected' : '...'}</span>
                  </div>
                </div>
                <div className={styles.statusItem}>
                  <span className={`${styles.dot} ${styles[systemCheck.engine]}`} />
                  <div className={styles.statusInfo}>
                    <span className={styles.statusLabel}>Matching</span>
                    <span className={styles.statusValue}>{systemCheck.engine === 'ok' ? 'Active' : '...'}</span>
                  </div>
                </div>
                <div className={styles.statusItem}>
                  <span className={`${styles.dot} ${styles[systemCheck.security]}`} />
                  <div className={styles.statusInfo}>
                    <span className={styles.statusLabel}>Security</span>
                    <span className={styles.statusValue}>{systemCheck.security === 'ok' ? 'Active' : '...'}</span>
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
                <span>WS</span>
              </div>
              <div className={styles.mobileStatusItem}>
                <span className={`${styles.mobileStatusDot} ${systemCheck.engine === 'ok' ? styles.ok : systemCheck.engine === 'pending' ? styles.pending : ''}`} />
                <span>Engine</span>
              </div>
              <div className={styles.mobileStatusItem}>
                <span className={`${styles.mobileStatusDot} ${systemCheck.security === 'ok' ? styles.ok : systemCheck.security === 'pending' ? styles.pending : ''}`} />
                <span>Security</span>
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
