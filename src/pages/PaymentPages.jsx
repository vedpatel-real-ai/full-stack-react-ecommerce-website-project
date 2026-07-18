import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useToast } from '../components/ToastContext';
import '../styles/PaymentPages.css';

// Payment Success Component
export function PaymentSuccess() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const [orderDetails, setOrderDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const orderId = searchParams.get('order_id') || searchParams.get('merchant_param1');
    if (orderId) {
      fetchOrderDetails(orderId);
    } else {
      setLoading(false);
      showToast('Order ID not found', 'error');
    }
  }, [searchParams]);

  const fetchOrderDetails = async (orderId) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) throw error;

      setOrderDetails(data);
      if (data.payment_status === 'COMPLETED') {
        showToast('Payment successful! Order confirmed.', 'success');
      }
    } catch (err) {
      console.error('Error fetching order:', err);
      showToast('Error loading order details', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="payment-status-container">
        <div className="payment-status-card">
          <div className="loading-spinner"></div>
          <p>Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (!orderDetails) {
    return (
      <div className="payment-status-container">
        <div className="payment-status-card error">
          <h1>❌ Order Not Found</h1>
          <p>We couldn't find your order details.</p>
          <button onClick={() => navigate('/')} className="btn btn-primary">
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  const isSuccess = orderDetails.payment_status === 'COMPLETED';

  return (
    <div className="payment-status-container">
      <div className={`payment-status-card ${isSuccess ? 'success' : 'error'}`}>
        <h1>{isSuccess ? '✅ Payment Successful!' : '❌ Payment Processing'}</h1>

        <div className="order-details">
          <h3>Order Details</h3>
          <div className="detail-row">
            <span>Order ID:</span>
            <span>#{orderDetails.id}</span>
          </div>
          <div className="detail-row">
            <span>Amount:</span>
            <span>₹{orderDetails.total_amount}</span>
          </div>
          <div className="detail-row">
            <span>Status:</span>
            <span className={`status ${orderDetails.payment_status.toLowerCase()}`}>
              {orderDetails.payment_status}
            </span>
          </div>
          {orderDetails.transaction_id && (
            <div className="detail-row">
              <span>Transaction ID:</span>
              <span>{orderDetails.transaction_id}</span>
            </div>
          )}
        </div>

        {isSuccess && (
          <div className="success-message">
            <p>🎉 Thank you for your purchase!</p>
            <p>Your order has been confirmed and you will receive an email confirmation shortly.</p>
          </div>
        )}

        <div className="action-buttons">
          {isSuccess && (
            <button
              onClick={() => navigate(`/order-confirmation/${orderDetails.id}`)}
              className="btn btn-success"
            >
              View Order Details
            </button>
          )}
          <button onClick={() => navigate('/')} className="btn btn-primary">
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
}

// Payment Cancel Component
export function PaymentCancel() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    showToast('Payment was cancelled', 'info');
  }, [showToast]);

  const orderId = searchParams.get('order_id') || searchParams.get('merchant_param1');

  return (
    <div className="payment-status-container">
      <div className="payment-status-card cancel">
        <h1>⚠️ Payment Cancelled</h1>

        <div className="cancel-message">
          <p>Your payment was cancelled and no charges have been made.</p>
          {orderId && <p>Order ID: #{orderId}</p>}
          <p>You can try again or choose a different payment method.</p>
        </div>

        <div className="action-buttons">
          <button onClick={() => navigate('/checkout')} className="btn btn-primary">
            Try Again
          </button>
          <button onClick={() => navigate('/cart')} className="btn btn-outline">
            Return to Cart
          </button>
          <button onClick={() => navigate('/')} className="btn btn-outline">
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
}

// Order Confirmation Component
export function OrderConfirmation() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [orderDetails, setOrderDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) throw error;
      setOrderDetails(data);
    } catch (err) {
      console.error('Error fetching order:', err);
      showToast('Error loading order details', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="payment-status-container">
        <div className="payment-status-card">
          <div className="loading-spinner"></div>
          <p>Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!orderDetails) {
    return (
      <div className="payment-status-container">
        <div className="payment-status-card error">
          <h1>Order Not Found</h1>
          <p>We couldn't find your order details.</p>
          <button onClick={() => navigate('/')} className="btn btn-primary">
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);

  return (
    <div className="order-confirmation-container">
      <div className="order-confirmation-card">
        <div className="confirmation-header">
          <h1>📋 Order Confirmation</h1>
          <p>Order #{orderDetails.id}</p>
        </div>

        <div className="order-info">
          <div className="info-section">
            <h3>Order Status</h3>
            <div className="status-info">
              <span className={`status-badge ${orderDetails.order_status.toLowerCase()}`}>
                {orderDetails.order_status}
              </span>
              <span className={`status-badge ${orderDetails.payment_status.toLowerCase()}`}>
                {orderDetails.payment_status}
              </span>
            </div>
          </div>

          <div className="info-section">
            <h3>Customer Information</h3>
            <div className="customer-info">
              <p>
                <strong>Name:</strong> {orderDetails.user_name}
              </p>
              <p>
                <strong>Email:</strong> {orderDetails.user_email}
              </p>
              <p>
                <strong>Phone:</strong> {orderDetails.user_phone}
              </p>
            </div>
          </div>

          <div className="info-section">
            <h3>Shipping Address</h3>
            <div className="address-info">
              <p>{orderDetails.address_line}</p>
              <p>
                {orderDetails.city}, {orderDetails.state} - {orderDetails.postal_code}
              </p>
            </div>
          </div>

          <div className="info-section">
            <h3>Order Items</h3>
            <div className="items-list">
              {orderDetails.product_list &&
                orderDetails.product_list.map((item, index) => (
                  <div key={index} className="order-item">
                    <div className="item-details">
                      <span className="item-name">{item.name}</span>
                      <span className="item-quantity">Qty: {item.quantity}</span>
                    </div>
                    <span className="item-price">
                      {formatCurrency(item.unit_price * item.quantity)}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          <div className="info-section">
            <h3>Order Summary</h3>
            <div className="order-summary">
              <div className="summary-row">
                <span>Total Amount:</span>
                <strong>{formatCurrency(orderDetails.total_amount)}</strong>
              </div>
              {orderDetails.ccavenue_tracking_id && (
                <div className="summary-row">
                  <span>Transaction ID:</span>
                  <span>{orderDetails.ccavenue_tracking_id}</span>
                </div>
              )}
              <div className="summary-row">
                <span>Order Date:</span>
                <span>{new Date(orderDetails.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="confirmation-actions">
          <button onClick={() => navigate('/')} className="btn btn-primary">
            Continue Shopping
          </button>
          <button onClick={() => window.print()} className="btn btn-outline">
            Print Order
          </button>
        </div>
      </div>
    </div>
  );
}
