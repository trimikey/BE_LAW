const admin = require('firebase-admin');
const { User } = require('../models');

// If serviceAccountKey.json is provided by the user, initialize it.
// For now, we use a try-catch for "mock" mode.
let firebaseReady = false;
try {
    const serviceAccount = require("../config/serviceAccountKey.json");
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    firebaseReady = true;
    console.log('Firebase Admin SDK initialized');
} catch (error) {
    console.warn('Firebase Admin SDK not initialized. (Missing config/serviceAccountKey.json)');
}

/**
 * Gửi thông báo đến 1 user
 */
const sendToUser = async (userId, title, body, data = {}) => {
    try {
        const user = await User.findByPk(userId);
        if (!user || !user.fcm_token) {
            console.log(`User ${userId} has no FCM token. Logging notification instead: [${title}] ${body}`);
            return;
        }

        if (!firebaseReady) {
            console.log(`[FIREBASE MOCK] Sending to ${user.full_name}: ${title} - ${body}`);
            return;
        }

        const message = {
            notification: { title, body },
            data: {
                ...data,
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            },
            token: user.fcm_token
        };

        const response = await admin.messaging().send(message);
        console.log('Successfully sent message:', response);
    } catch (error) {
        console.error('Error sending notification:', error);
    }
};

/**
 * Gửi thông báo khi có tin nhắn mới
 */
const notifyNewMessage = async (sender, receiverId, content) => {
    const title = `${sender.full_name} đã gửi tin nhắn`;
    const body = content.length > 50 ? content.substring(0, 47) + '...' : content;

    await sendToUser(receiverId, title, body, {
        type: 'chat',
        sender_id: sender.id.toString()
    });
};

/**
 * Gửi thông báo khi trạng thái vụ việc thay đổi
 */
const notifyCaseUpdate = async (caseRecord, title, message) => {
    await sendToUser(caseRecord.client_id, title, message, {
        type: 'case_update',
        case_id: caseRecord.id.toString()
    });
};

module.exports = {
    sendToUser,
    notifyNewMessage,
    notifyCaseUpdate
};
