import { useState } from 'react';
import { App as AntApp, Button, Form, Input, Steps, Typography } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { homePathForUser, useAuth } from '../config/AuthContext.jsx';
import {
  digitsOnlyPhone,
  phoneFieldRules,
  phoneInputProps,
} from '../utils/phoneValidation.js';

export default function Login() {
  const { login, registerOrganization, getApiErrorMessage } = useAuth();
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [signupStep, setSignupStep] = useState(0);
  const [loginLoading, setLoginLoading] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [loginForm] = Form.useForm();
  const [signupForm] = Form.useForm();

  const showSignup = () => {
    setSignupStep(0);
    setMode('signup');
  };

  const showLogin = () => {
    setMode('login');
    setSignupStep(0);
  };

  const onLogin = async (values) => {
    setLoginLoading(true);
    try {
      const me = await login(values.email.trim(), values.password);
      message.success(`Welcome, ${me.full_name}`);
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

  const onRegister = async () => {
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
      signupForm.resetFields();
      setSignupStep(0);
      navigate(homePathForUser(me), { replace: true });
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Registration failed'));
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 font-sans">
      <AnimatePresence mode="wait">
        {mode === 'login' ? (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
          >
            <Typography.Title level={3} className="!mb-1 !font-sans !text-slate-800">
              Sign in
            </Typography.Title>
            <Typography.Text className="mb-6 block text-slate-500">
              Use your work email to continue.
            </Typography.Text>

            <Form form={loginForm} layout="vertical" onFinish={onLogin} requiredMark="optional" autoComplete="off">
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Enter your email' },
                  { type: 'email', message: 'Enter a valid email' },
                ]}
              >
                <Input size="large" placeholder="admin@company.com" autoComplete="off" className="!rounded-lg" />
              </Form.Item>
              <Form.Item
                name="password"
                label="Password"
                rules={[{ required: true, message: 'Enter your password' }]}
              >
                <Input.Password
                  size="large"
                  placeholder="Password"
                  autoComplete="off"
                  name="login-password"
                  className="!rounded-lg"
                />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loginLoading}
                className="!mt-2 !h-11 !rounded-full !bg-teal-600 !font-semibold hover:!bg-teal-700"
                icon={<ArrowRightOutlined />}
                iconPlacement="end"
              >
                Sign in
              </Button>
            </Form>

            <p className="mt-5 text-center text-[14px] text-slate-500">
              New organization?{' '}
              <button
                type="button"
                className="font-semibold text-teal-600 hover:text-teal-700"
                onClick={showSignup}
              >
                Sign up
              </button>
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="signup"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
          >
            <Typography.Title level={3} className="!mb-1 !font-sans !text-slate-800">
              Sign up
            </Typography.Title>
            <Typography.Text className="mb-5 block text-slate-500">
              Register your organization, then set up the admin account.
            </Typography.Text>

            <Steps
              size="small"
              current={signupStep}
              className="mb-6"
              items={[
                { title: 'Organization' },
                { title: 'Admin details' },
              ]}
            />

            <Form form={signupForm} layout="vertical" requiredMark="optional" autoComplete="off">
              <div className={signupStep === 0 ? 'block' : 'hidden'}>
                <Form.Item
                  name="organization_name"
                  label="Organization name"
                  rules={[{ required: true, message: 'Required' }, { min: 2 }]}
                >
                  <Input size="large" placeholder="Precision Labs Pvt Ltd" className="!rounded-lg" />
                </Form.Item>
                <Form.Item
                  name="organization_code"
                  label="Organization code"
                  rules={[{ required: true, message: 'Required' }, { min: 2 }, { max: 50 }]}
                >
                  <Input size="large" placeholder="PRECLAB" className="!rounded-lg uppercase" />
                </Form.Item>
                <Form.Item
                  name="address"
                  label="Address"
                  rules={[{ required: true, message: 'Required' }]}
                >
                  <Input.TextArea size="large" rows={3} placeholder="Street, city, PIN" className="!rounded-lg" />
                </Form.Item>
                <Button
                  type="primary"
                  size="large"
                  block
                  onClick={goToAdminStep}
                  className="!h-11 !rounded-full !bg-teal-600 !font-semibold hover:!bg-teal-700"
                  icon={<ArrowRightOutlined />}
                  iconPlacement="end"
                >
                  Continue
                </Button>
              </div>

              <div className={signupStep === 1 ? 'block' : 'hidden'}>
                <Form.Item
                  name="full_name"
                  label="Admin full name"
                  rules={[{ required: true, message: 'Required' }, { min: 2 }]}
                >
                  <Input size="large" placeholder="Your name" className="!rounded-lg" />
                </Form.Item>
                <Form.Item
                  name="email"
                  label="Work email"
                  rules={[
                    { required: true, message: 'Required' },
                    { type: 'email', message: 'Valid email required' },
                  ]}
                >
                  <Input size="large" placeholder="admin@company.com" autoComplete="off" className="!rounded-lg" />
                </Form.Item>
                <Form.Item
                  name="phone"
                  label="Phone"
                  rules={phoneFieldRules({ required: true, label: 'phone' })}
                  getValueFromEvent={(e) => digitsOnlyPhone(e.target.value)}
                >
                  <Input size="large" className="!rounded-lg" {...phoneInputProps()} />
                </Form.Item>
                <Form.Item
                  name="password"
                  label="Password"
                  rules={[{ required: true, message: 'Required' }, { min: 8, message: 'Min 8 characters' }]}
                >
                  <Input.Password size="large" autoComplete="off" className="!rounded-lg" />
                </Form.Item>
                <Form.Item
                  name="confirm"
                  label="Confirm password"
                  dependencies={['password']}
                  rules={[
                    { required: true, message: 'Confirm password' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value) return Promise.resolve();
                        return Promise.reject(new Error('Passwords do not match'));
                      },
                    }),
                  ]}
                >
                  <Input.Password size="large" autoComplete="off" className="!rounded-lg" />
                </Form.Item>
                <div className="flex gap-2">
                  <Button
                    size="large"
                    className="!h-11 !rounded-full"
                    onClick={() => setSignupStep(0)}
                    disabled={signupLoading}
                  >
                    Back
                  </Button>
                  <Button
                    type="primary"
                    size="large"
                    className="!h-11 flex-1 !rounded-full !bg-teal-600 !font-semibold hover:!bg-teal-700"
                    loading={signupLoading}
                    onClick={onRegister}
                  >
                    Register &amp; Sign in
                  </Button>
                </div>
              </div>
            </Form>

            <p className="mt-5 text-center text-[14px] text-slate-500">
              Already registered?{' '}
              <button
                type="button"
                className="font-semibold text-teal-600 hover:text-teal-700"
                onClick={showLogin}
              >
                Sign in
              </button>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
