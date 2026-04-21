exports.handler = async () => {
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            vapidPublicKey: process.env.VAPID_PUBLIC_KEY
        })
    };
};
