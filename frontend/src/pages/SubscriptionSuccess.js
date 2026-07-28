import React from 'react';
import { Link } from 'react-router-dom';

const SubscriptionSuccess = () => {
  return (
    <main style={{padding: '2rem'}}>
      <h1>Subscription successful</h1>
      <p>Thank you — your subscription is active. You may need to return to your account to refresh status.</p>
      <p>
        <Link to="/account">Go to account</Link>
      </p>
    </main>
  );
};

export default SubscriptionSuccess;
