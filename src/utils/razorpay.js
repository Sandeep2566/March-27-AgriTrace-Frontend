import Razorpay from 'razorpay';

const createRazorpayInstance = (key_id, key_secret) => {
  return new Razorpay({ key_id, key_secret });
};

export default createRazorpayInstance;
