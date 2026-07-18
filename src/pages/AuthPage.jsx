import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useToast } from '../components/ToastContext';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../AppContext';
import '../styles/AuthPage.css';

function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const { showToast } = useToast();
  const navigate = useNavigate();
  const { user } = useAppContext();
  const session = user ? { user } : null;

  useEffect(() => {
    setEmail('customer@demo.com');
    setName('Demo Customer');
  }, [session]);

  const handleSignUp = async () => {
    if (!name) {
      showToast('❌ Please enter your name for sign-up.', 'error');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (error) {
      showToast(`❌ ${error.message}`, 'error');
    } else {
      showToast('Demo account ready. No email confirmation is sent.', 'success');

      if (data.user) {
        const userId = data.user.id;
        const { error: profileError } = await supabase.from('users').insert({
          id: userId,
          email,
          name,
          role: 'user' // default role
        });

        if (profileError) {
          showToast(`❌ ${profileError.message}`, 'error');
        }
      }

      navigate('/');
    }

    setLoading(false);
  };

  const handleLogin = async () => {
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      showToast(`❌ ${error.message}`, 'error');
    } else if (data?.session?.user) {
      showToast('✅ Logged in successfully!', 'success');
      
      await mergeGuestCart(data.session.user.id);

      const userId = data.session.user.id;

      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('❌ Failed to fetch user profile:', profileError);
      }

      if (!userProfile) {
        await supabase.from('users').insert({
          id: userId,
          email,
          name: name || '',
          role: 'user'
        });
        navigate('/');
      } else if (userProfile.role === 'administrator' || userProfile.role === 'admin') {
        navigate('/admin-landing');
      } else {
        navigate('/');
      }
    }

    setLoading(false);
  };

  const mergeGuestCart = async (userId) => {
    const guestCart = JSON.parse(sessionStorage.getItem('guest_cart')) || [];
    
    if (guestCart.length === 0) {
      return; // No guest cart to merge
    }

    console.log('🔄 Merging guest cart to user account...');
    
    for (const item of guestCart) {
      const { error } = await supabase.from('cart_items').upsert(
        {
          user_id: userId,
          product_id: item.productId,
          quantity: item.quantity,
        },
        { onConflict: ['user_id', 'product_id'] }
      );

      if (error) {
        console.error('Cart merge error:', error);
        showToast(`❌ Failed to merge cart for ${item.productId}`, 'error');
      }
    }
    
    sessionStorage.removeItem('guest_cart');
    showToast('✅ Guest cart merged to your account!', 'success');
  };

  // Show loading state while session is being determined
  if (session === undefined) {
    return (
      <div className="auth-page">
        <div className="loading-container">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <h1>Login / Sign Up</h1>
      
      {session && session.user?.email?.includes('guest_') && (
        <div className="guest-notice">
          <p>🎭 You're currently browsing as a guest. Login or sign up to save your orders and preferences!</p>
        </div>
      )}
      
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={loading}
      />
      <input
        type="text"
        placeholder="Name (for sign-up only)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={loading}
      />
      <button onClick={handleSignUp} disabled={loading}>
        {loading ? 'Processing...' : 'Sign Up'}
      </button>
      <button onClick={handleLogin} disabled={loading}>
        {loading ? 'Processing...' : 'Log In'}
      </button>
    </div>
  );
}

export default AuthPage;
