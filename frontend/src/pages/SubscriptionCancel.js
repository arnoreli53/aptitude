import React from 'react';
import { Link } from 'react-router-dom';

const SubscriptionCancel = () => {
  return (
    <main style={{padding: '2rem'}}>
      <h1>Subscription canceled</h1>
      <p>Your subscription attempt was cancelled. If this was a mistake you can try again from your account page.</p>
      <p>
        <Link to="/account">Return to account</Link>
      </p>
    </main>
  );
};

export default SubscriptionCancel;
