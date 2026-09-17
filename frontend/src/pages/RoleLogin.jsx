import { useState } from 'react';
import { App as AntApp, Button, Form, Input, Steps, Tabs, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { homePathForUser, useAuth } from '../config/auth.jsx';

function AuthPageInner() {
  const { login, registerOrganization, getApiErrorMessage } = useAuth();
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState('login');
  const [signupStep, setSignupStep] = useState(0);
  const [loginLoading, setLoginLoading] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [loginForm] = Form.useForm();
  const [signupForm] = Form.useForm();

  const resetSignup = () => {
    setSignupStep(0);
    signupForm.resetFields();
  };

  const onTabChange = (key) => {
    setTab(key);
    if (key === 'signup') {
      setSignupStep(0);
    }
  };

  const onLogin = async (values) => {
    setLoginLoading(true);
    try {
      const me = await login(values.email.trim(), values.password);
      message.success(`Welcome back, ${me.full_name}`);
      navigate(homePathForUser(me), { replace: true });
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Login failed'));
    } finally {
      setLoginLoading(false);
    }
  };

  const goToAdminStep = async () => {
    await signupForm.validateFields(['organization_name', 'organization_code', 'address']);
    setSignupStep(1);
  };

  const onRegisterAndSignIn = async () => {
    const values = await signupForm.validateFields([
      'organization_name',
      'organization_code',
      'address',
      'full_name',
      'email',
      'phone',
      'password',
      'confirm',
    ]);

    setSignupLoading(true);
    try {
      const me = await registerOrganization({
        organization_name: values.organization_name.trim(),
        organization_code: values.organization_code.trim().toUpperCase(),
        address: values.address?.trim() || null,
        full_name: values.full_name.trim(),
        email: values.email.trim(),
        password: values.password,
        phone: values.phone?.trim() || null,
      });
      message.success(`Organization registered. Welcome, ${me.full_name}`);
      resetSignup();
      navigate(homePathForUser(me), { replace: true });
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Registration failed'));
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide">
        <div className="auth-brand">
          <Typography.Title level={2} className="auth-brand-title">
            Quotation Modal
          </Typography.Title>
        </div>

        <Tabs
          activeKey={tab}
          onChange={onTabChange}
          destroyInactiveTabPane={false}
          items={[
            {
              key: 'login',
              label: 'Sign In',
              forceRender: true,
              children: (
                <Form form={loginForm} layout="vertical" onFinish={onLogin} requiredMark={false}>
                  <Form.Item
                    name="email"
                    label="Email"
                    rules={[
                      { required: true, message: 'Enter your email' },
                      { type: 'email', message: 'Enter a valid email' },
                    ]}
                  >
                    <Input size="large" placeholder="admin@company.com" autoComplete="email" />
                  </Form.Item>
                  <Form.Item
                    name="password"
                    label="Password"
                    rules={[{ required: true, message: 'Enter your password' }]}
                  >
                    <Input.Password size="large" placeholder="Your password" autoComplete="current-password" />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" size="large" block loading={loginLoading}>
                    Sign In
                  </Button>
                  <p className="auth-switch-hint">
                    New organization?{' '}
                    <button type="button" className="auth-link" onClick={() => onTabChange('signup')}>
                      Register here
                    </button>
                  </p>
                </Form>
              ),
            },
            {
              key: 'signup',
              label: 'Register',
              forceRender: true,
              children: (
                <div>
                  <Steps
                    size="small"
                    current={signupStep}
                    className="auth-steps"
                    items={[
                      { title: 'Organization' },
                      { title: 'Admin details' },
                    ]}
                  />

                  <Form form={signupForm} layout="vertical" requiredMark="optional">
                    <div style={{ display: signupStep === 0 ? 'block' : 'none' }}>
                      <Typography.Paragraph type="secondary">
                        Step 1 — Register your organization details.
                      </Typography.Paragraph>
                      <Form.Item
                        name="organization_name"
                        label="Organization name"
                        rules={[
                          { required: true, message: 'Enter organization name' },
                          { min: 2, message: 'At least 2 characters' },
                        ]}
                      >
                        <Input size="large" placeholder="Precision Labs Pvt Ltd" />
                      </Form.Item>
                      <Form.Item
                        name="organization_code"
                        label="Organization code"
                        extra="Unique short code for your tenant"
                        rules={[
                          { required: true, message: 'Enter organization code' },
                          { min: 2, message: 'At least 2 characters' },
                          { max: 50, message: 'Max 50 characters' },
                        ]}
                      >
                        <Input size="large" placeholder="PRECLAB" style={{ textTransform: 'uppercase' }} />
                      </Form.Item>
                      <Form.Item
                        name="address"
                        label="Address"
                        rules={[{ required: true, message: 'Enter organization address' }]}
                      >
                        <Input.TextArea
                          size="large"
                          rows={3}
                          placeholder="Street, city, state, PIN"
                          autoComplete="street-address"
                        />
                      </Form.Item>
                      <Button type="primary" size="large" block onClick={goToAdminStep}>
                        Continue to Admin details
                      </Button>
                    </div>

                    <div style={{ display: signupStep === 1 ? 'block' : 'none' }}>
                      <Typography.Paragraph type="secondary">
                        Step 2 — Create the admin account, then register and sign in.
                      </Typography.Paragraph>
                      <Form.Item
                        name="full_name"
                        label="Full name"
                        rules={[
                          { required: true, message: 'Enter your full name' },
                          { min: 2, message: 'At least 2 characters' },
                        ]}
                      >
                        <Input size="large" placeholder="Admin name" autoComplete="name" />
                      </Form.Item>
                      <Form.Item
                        name="email"
                        label="Email"
                        rules={[
                          { required: true, message: 'Enter admin email' },
                          { type: 'email', message: 'Enter a valid email' },
                        ]}
                      >
                        <Input size="large" placeholder="admin@company.com" autoComplete="email" />
                      </Form.Item>
                      <Form.Item
                        name="phone"
                        label="Mobile number"
                        rules={[{ required: true, message: 'Enter mobile number' }]}
                      >
                        <Input size="large" placeholder="Mobile number" autoComplete="tel" />
                      </Form.Item>
                      <Form.Item
                        name="password"
                        label="Password"
                        rules={[
                          { required: true, message: 'Create a password' },
                          { min: 8, message: 'At least 8 characters' },
                        ]}
                      >
                        <Input.Password size="large" placeholder="Min 8 characters" autoComplete="new-password" />
                      </Form.Item>
                      <Form.Item
                        name="confirm"
                        label="Confirm password"
                        dependencies={['password']}
                        rules={[
                          { required: true, message: 'Confirm your password' },
                          ({ getFieldValue }) => ({
                            validator(_, value) {
                              if (!value || getFieldValue('password') === value) return Promise.resolve();
                              return Promise.reject(new Error('Passwords do not match'));
                            },
                          }),
                        ]}
                      >
                        <Input.Password size="large" placeholder="Re-enter password" autoComplete="new-password" />
                      </Form.Item>

                      <div className="auth-step-actions">
                        <Button size="large" onClick={() => setSignupStep(0)} disabled={signupLoading}>
                          Back
                        </Button>
                        <Button
                          type="primary"
                          size="large"
                          block
                          loading={signupLoading}
                          onClick={onRegisterAndSignIn}
                        >
                          Register &amp; Sign In
                        </Button>
                      </div>
                    </div>
                  </Form>

                  <p className="auth-switch-hint">
                    Already registered?{' '}
                    <button type="button" className="auth-link" onClick={() => onTabChange('login')}>
                      Sign in
                    </button>
                  </p>
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

export default function AuthPage() {
  return <AuthPageInner />;
}
