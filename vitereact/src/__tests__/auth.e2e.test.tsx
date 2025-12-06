import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

import UV_Login from '@/components/views/UV_Login';
import { useAppStore } from '@/store/main';

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('Auth E2E Flow (register -> logout -> sign-in)', () => {
  beforeEach(() => {
    // Clear localStorage to ensure clean state
    localStorage.clear();
    
    // Reset Zustand store to initial unauthenticated state
    useAppStore.setState({
      authentication_state: {
        current_user: null,
        auth_token: null,
        authentication_status: {
          is_authenticated: false,
          is_loading: false,
        },
        error_message: null,
      },
    });
  });

  it('completes full auth flow: register -> logout -> sign-in', async () => {
    // Generate unique email to avoid conflicts with existing users
    const uniqueEmail = `user${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    const testName = 'Test User';

    const user = userEvent.setup();

    // ============ STEP 1: REGISTER ============
    const { unmount } = render(<UV_Login />, { wrapper: Wrapper });

    // Wait for component to be fully rendered and not loading
    await waitFor(() => {
      const state = useAppStore.getState();
      expect(state.authentication_state.authentication_status.is_loading).toBe(false);
    });

    // Check that we're on the sign-in mode initially
    expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();

    // Switch to register mode
    const toggleButton = screen.getByRole('button', { 
      name: /don't have an account\? sign up/i 
    });
    await user.click(toggleButton);

    // Wait for register mode to be active
    await waitFor(() => {
      expect(screen.getByText(/create your account/i)).toBeInTheDocument();
    });

    // Find and fill registration form fields
    const nameInput = screen.getByPlaceholderText(/full name/i);
    const emailInput = screen.getByPlaceholderText(/email address/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    // Ensure inputs are enabled
    await waitFor(() => {
      expect(nameInput).not.toBeDisabled();
      expect(emailInput).not.toBeDisabled();
      expect(passwordInput).not.toBeDisabled();
    });

    // Fill in registration form
    await user.type(nameInput, testName);
    await user.type(emailInput, uniqueEmail);
    await user.type(passwordInput, testPassword);

    // Submit registration
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    await user.click(submitButton);

    // Wait for loading state to appear
    await waitFor(() => {
      expect(screen.getByText(/creating account\.\.\./i)).toBeInTheDocument();
    }, { timeout: 5000 });

    // Wait for registration to complete and store to reflect authenticated state
    await waitFor(
      () => {
        const state = useAppStore.getState();
        expect(state.authentication_state.authentication_status.is_authenticated).toBe(true);
        expect(state.authentication_state.auth_token).toBeTruthy();
        expect(state.authentication_state.current_user).toBeTruthy();
        expect(state.authentication_state.current_user?.email).toBe(uniqueEmail);
        expect(state.authentication_state.current_user?.name).toBe(testName);
      },
      { timeout: 20000 }
    );

    console.log('✓ Registration successful');

    // ============ STEP 2: LOGOUT ============
    // Manually call logout action
    const logoutUser = useAppStore.getState().logout_user;
    logoutUser();

    // Verify store is cleared after logout
    await waitFor(() => {
      const state = useAppStore.getState();
      expect(state.authentication_state.authentication_status.is_authenticated).toBe(false);
      expect(state.authentication_state.auth_token).toBeNull();
      expect(state.authentication_state.current_user).toBeNull();
    });

    console.log('✓ Logout successful');

    // ============ STEP 3: SIGN-IN ============
    // Unmount and re-render a fresh login component to simulate navigation
    unmount();
    render(<UV_Login />, { wrapper: Wrapper });

    // Wait for component to be in sign-in mode (default mode)
    await waitFor(() => {
      expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
    });

    // Find and fill sign-in form fields
    const signInEmailInput = screen.getByPlaceholderText(/email address/i);
    const signInPasswordInput = screen.getByPlaceholderText(/password/i);
    const signInButton = screen.getByRole('button', { name: /sign in$/i });

    // Ensure inputs are enabled
    await waitFor(() => {
      expect(signInEmailInput).not.toBeDisabled();
      expect(signInPasswordInput).not.toBeDisabled();
    });

    // Fill in sign-in form with the same credentials used for registration
    await user.type(signInEmailInput, uniqueEmail);
    await user.type(signInPasswordInput, testPassword);

    // Submit sign-in
    await waitFor(() => expect(signInButton).not.toBeDisabled());
    await user.click(signInButton);

    // Wait for loading state to appear
    await waitFor(() => {
      expect(screen.getByText(/signing in\.\.\./i)).toBeInTheDocument();
    }, { timeout: 5000 });

    // Wait for sign-in to complete and store to reflect authenticated state
    await waitFor(
      () => {
        const state = useAppStore.getState();
        expect(state.authentication_state.authentication_status.is_authenticated).toBe(true);
        expect(state.authentication_state.auth_token).toBeTruthy();
        expect(state.authentication_state.current_user).toBeTruthy();
        expect(state.authentication_state.current_user?.email).toBe(uniqueEmail);
        expect(state.authentication_state.current_user?.name).toBe(testName);
      },
      { timeout: 20000 }
    );

    console.log('✓ Sign-in successful');
    console.log('✓ Full E2E auth flow completed successfully');
  }, 60000); // Increase timeout to 60 seconds for the full flow

  it('handles invalid credentials during sign-in', async () => {
    const user = userEvent.setup();

    render(<UV_Login />, { wrapper: Wrapper });

    // Wait for component to be fully rendered
    await waitFor(() => {
      const state = useAppStore.getState();
      expect(state.authentication_state.authentication_status.is_loading).toBe(false);
    });

    // Component should be in sign-in mode by default
    expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();

    // Find form fields
    const emailInput = screen.getByPlaceholderText(/email address/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in$/i });

    // Try to sign in with invalid credentials
    await user.type(emailInput, 'nonexistent@example.com');
    await user.type(passwordInput, 'wrongpassword');

    await waitFor(() => expect(submitButton).not.toBeDisabled());
    await user.click(submitButton);

    // Wait for error message to appear
    await waitFor(
      () => {
        const state = useAppStore.getState();
        expect(state.authentication_state.error_message).toBeTruthy();
        expect(state.authentication_state.authentication_status.is_authenticated).toBe(false);
      },
      { timeout: 10000 }
    );

    // Error message should be displayed in UI
    await waitFor(() => {
      const errorElement = screen.getByText(/invalid email or password/i);
      expect(errorElement).toBeInTheDocument();
    });

    console.log('✓ Invalid credentials error handled correctly');
  }, 30000);

  it('handles registration with duplicate email', async () => {
    // First, register a user with a unique email
    const uniqueEmail = `duplicate${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    const testName = 'Test User';

    const user = userEvent.setup();

    const { unmount } = render(<UV_Login />, { wrapper: Wrapper });

    // Switch to register mode
    const toggleButton = screen.getByRole('button', { 
      name: /don't have an account\? sign up/i 
    });
    await user.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByText(/create your account/i)).toBeInTheDocument();
    });

    // Fill and submit first registration
    const nameInput = screen.getByPlaceholderText(/full name/i);
    const emailInput = screen.getByPlaceholderText(/email address/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await user.type(nameInput, testName);
    await user.type(emailInput, uniqueEmail);
    await user.type(passwordInput, testPassword);

    await waitFor(() => expect(submitButton).not.toBeDisabled());
    await user.click(submitButton);

    // Wait for first registration to complete
    await waitFor(
      () => {
        const state = useAppStore.getState();
        expect(state.authentication_state.authentication_status.is_authenticated).toBe(true);
      },
      { timeout: 20000 }
    );

    // Logout
    useAppStore.getState().logout_user();

    await waitFor(() => {
      const state = useAppStore.getState();
      expect(state.authentication_state.authentication_status.is_authenticated).toBe(false);
    });

    // Unmount and render fresh component to reset state
    unmount();
    render(<UV_Login />, { wrapper: Wrapper });

    // Wait for sign-in mode to render
    await waitFor(() => {
      expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
    });

    // Try to register again with the same email - switch to register mode
    const toggleButtonAgain = screen.getByRole('button', { 
      name: /don't have an account\? sign up/i 
    });
    await user.click(toggleButtonAgain);

    await waitFor(() => {
      expect(screen.getByText(/create your account/i)).toBeInTheDocument();
    });

    const nameInput2 = screen.getByPlaceholderText(/full name/i);
    const emailInput2 = screen.getByPlaceholderText(/email address/i);
    const passwordInput2 = screen.getByPlaceholderText(/password/i);
    const submitButton2 = screen.getByRole('button', { name: /create account/i });

    await user.type(nameInput2, 'Another Name');
    await user.type(emailInput2, uniqueEmail); // Same email
    await user.type(passwordInput2, testPassword);

    await waitFor(() => expect(submitButton2).not.toBeDisabled());
    await user.click(submitButton2);

    // Wait for error message about duplicate email
    await waitFor(
      () => {
        const state = useAppStore.getState();
        expect(state.authentication_state.error_message).toBeTruthy();
        expect(state.authentication_state.error_message).toMatch(/already exists/i);
        expect(state.authentication_state.authentication_status.is_authenticated).toBe(false);
      },
      { timeout: 10000 }
    );

    console.log('✓ Duplicate email error handled correctly');
  }, 60000);
});
