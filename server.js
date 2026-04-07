const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http'); // Import http module

dotenv.config(); // Add http module

const { sequelize } = require('./models');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const lawyerRoutes = require('./routes/lawyerRoutes');
const clientRoutes = require('./routes/clientRoutes');
const caseRoutes = require('./routes/caseRoutes');
const documentRoutes = require('./routes/documentRoutes');
const marketplaceRoutes = require('./routes/marketplaceRoutes');
const messageRoutes = require('./routes/messageRoutes'); // Add messageRoutes
const inquiryRoutes = require('./routes/inquiryRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();
const server = http.createServer(app); // Create http server
const { Server } = require("socket.io"); // Import Server from socket.io
const {
    getQuotaStatusForUsers,
    consumeCallSecondsForUsers,
    resolveClientLawyerPair,
    autoExpireConsultations,
    markConsultationCompleted,
    notifyUpcomingConsultations
} = require('./services/videoCallQuota.service');

const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:3001',
    'https://lawyer-platform-deploy-2c5w.vercel.app',
    'https://lawyer-platform-vpr4.vercel.app'
].filter(Boolean);

const io = new Server(server, { // Initialize socket.io
    cors: {
        origin: true, // Allow all origins
        methods: ["GET", "POST"],
        credentials: true
    }
});
app.set('io', io);

// Middleware
app.use(cors({
    origin: true, // Allow all origins
    credentials: true
}));

const PORT = process.env.PORT || 3001;
const onlineUsers = new Map(); // userId -> Set(socketId)
const socketToUser = new Map(); // socketId -> userId
const lastSeenMap = new Map(); // userId -> ISO date
const activeVideoCalls = new Map(); // pairKey -> { callerId, calleeId, startedAt, timeoutRef }
const disconnectGraceTimers = new Map(); // userId -> timeoutRef

const getPairKey = (userA, userB) => {
    const [a, b] = [Number(userA), Number(userB)].sort((x, y) => x - y);
    return `${a}:${b}`;
};

const getActiveCallByUsers = (userA, userB) => {
    return activeVideoCalls.get(getPairKey(userA, userB));
};

const buildStartedPayload = (call) => {
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - call.startedAt) / 1000));
    const remainingSeconds = Math.max(0, Number(call.allowedSeconds || 0) - elapsedSeconds);

    return {
        callerId: call.callerId,
        calleeId: call.calleeId,
        allowedSeconds: remainingSeconds,
        startedAt: call.startedAt,
        resumed: true
    };
};

// Middleware
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running!',
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/lawyer', lawyerRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/ai', aiRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route không tồn tại.'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Lỗi server nội bộ.',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Sync database và start server

const startServer = async () => {
    try {
        // Test connection
        await sequelize.authenticate();
        console.log('✅ Kết nối database thành công!');

        // Sync models (chỉ trong development, không force trong production)
        const shouldSync = process.env.DB_SYNC === 'true';
        if (shouldSync) {
            console.log('🔄 Đang đồng bộ database...');
            await sequelize.sync({ alter: false }); // Tắt alter: true để tránh lỗi ER_TOO_MANY_KEYS
            console.log('✅ Đồng bộ database thành công!');
        }

        // KIỂM TRA KẾT NỐI SMTP (Để debug lỗi gửi mail trên Deploy)
        const { verifySmtpConnection } = require('./utils/email');
        verifySmtpConnection().catch(() => {
            console.log('⚠️ Cảnh báo: SMTP chưa được cấu hình đúng, các tính năng gửi mail có thể không hoạt động.');
        });

        // Add Socket.io logic here or ensure it's initialized before verify
        const finalizeVideoCall = async (callerId, calleeId, reason, endedBy) => {
            const key = getPairKey(callerId, calleeId);
            const call = activeVideoCalls.get(key);
            if (!call) return;

            activeVideoCalls.delete(key);
            if (call.timeoutRef) clearTimeout(call.timeoutRef);

            const elapsedSeconds = Math.max(0, Math.ceil((Date.now() - call.startedAt) / 1000));

            try {
                await consumeCallSecondsForUsers({
                    userId: callerId,
                    partnerId: calleeId,
                    elapsedSeconds
                });

                // Nếu cuộc gọi kéo dài hơn 60 giây, đánh dấu Tư vấn là hoàn thành
                if (elapsedSeconds > 60) {
                    await markConsultationCompleted(callerId, calleeId);
                }
            } catch (error) {
                console.error('Failed to consume call seconds or update consultation:', error);
            }

            io.to(String(callerId)).emit('video_call_ended', {
                reason,
                endedBy,
                elapsedSeconds
            });
            io.to(String(calleeId)).emit('video_call_ended', {
                reason,
                endedBy,
                elapsedSeconds
            });
        };

        io.on('connection', (socket) => {
            console.log('User connected: ' + socket.id);
            socket.on('join_room', (userId) => {
                const normalizedUserId = String(userId || '').trim();
                if (!normalizedUserId) return;

                socket.join(normalizedUserId);
                socketToUser.set(socket.id, normalizedUserId);

                if (!onlineUsers.has(normalizedUserId)) {
                    onlineUsers.set(normalizedUserId, new Set());
                }
                onlineUsers.get(normalizedUserId).add(socket.id);
                lastSeenMap.delete(normalizedUserId);

                const existingTimer = disconnectGraceTimers.get(normalizedUserId);
                if (existingTimer) {
                    clearTimeout(existingTimer);
                    disconnectGraceTimers.delete(normalizedUserId);
                }

                io.emit('presence_update', {
                    userId: Number(normalizedUserId),
                    isOnline: true,
                    lastSeen: null
                });
            });

            socket.on('get_presence', ({ targetUserId } = {}) => {
                const normalizedTargetId = String(targetUserId || '').trim();
                if (!normalizedTargetId) return;

                socket.emit('presence_state', {
                    userId: Number(normalizedTargetId),
                    isOnline: onlineUsers.has(normalizedTargetId),
                    lastSeen: lastSeenMap.get(normalizedTargetId) || null
                });
            });

            socket.on('typing', ({ fromUserId, toUserId, isTyping } = {}) => {
                const from = Number(fromUserId);
                const to = Number(toUserId);
                if (!from || !to) return;

                io.to(String(to)).emit('typing_update', {
                    fromUserId: from,
                    isTyping: Boolean(isTyping)
                });
            });

            socket.on('send_message', async (data, callback) => {
                try {
                    const Message = require('./models/message');
                    const senderId = Number(data?.sender_id);
                    const receiverId = Number(data?.receiver_id);
                    const content = String(data?.content || '').trim();
                    const joinedUserId = Number(socketToUser.get(socket.id));

                    if (!senderId || !receiverId || !content || joinedUserId !== senderId) {
                        if (typeof callback === 'function') {
                            callback({ success: false, message: 'Invalid message payload' });
                        }
                        return;
                    }

                    const saved = await Message.create({
                        sender_id: senderId,
                        receiver_id: receiverId,
                        content,
                        type: data.type || 'text'
                    });

                    io.to(String(receiverId)).emit('receive_message', saved);
                    io.to(String(senderId)).emit('receive_message', saved);

                    // Push Notification if receiver is offline
                    const isOnline = onlineUsers.has(String(receiverId));
                    if (!isOnline) {
                        const notificationService = require('./services/notification.service');
                        const sender = await User.findByPk(senderId, { attributes: ['id', 'full_name'] });
                        if (sender) {
                            await notificationService.notifyNewMessage(sender, receiverId, content);
                        }
                    }

                    if (typeof callback === 'function') {
                        callback({ success: true, data: saved });
                    }
                } catch (e) {
                    console.error('send_message error:', e);
                    if (typeof callback === 'function') {
                        callback({ success: false, message: 'Save message failed' });
                    }
                }
            });

            socket.on('video_call_request', async ({ fromUserId, toUserId } = {}) => {
                try {
                    const from = Number(fromUserId);
                    const to = Number(toUserId);
                    const joinedUserId = Number(socketToUser.get(socket.id));
                    if (!from || !to || joinedUserId !== from) return;

                    await resolveClientLawyerPair(from, to);

                    if (getActiveCallByUsers(from, to)) {
                        const existingCall = getActiveCallByUsers(from, to);
                        const payload = buildStartedPayload(existingCall);
                        io.to(String(existingCall.callerId)).emit('video_call_started', payload);
                        io.to(String(existingCall.calleeId)).emit('video_call_started', payload);
                        return;
                    }

                    io.to(String(to)).emit('video_call_incoming', { callerId: from });
                } catch (error) {
                    socket.emit('video_call_error', { message: error.message || 'Cannot request video call' });
                }
            });

            socket.on('video_call_decline', ({ callerId, calleeId } = {}) => {
                const caller = Number(callerId);
                const callee = Number(calleeId);
                const joinedUserId = Number(socketToUser.get(socket.id));
                if (!caller || !callee || joinedUserId !== callee) return;

                io.to(String(caller)).emit('video_call_declined', { calleeId: callee });
            });

            socket.on('video_call_accept', async ({ callerId, calleeId } = {}) => {
                try {
                    const caller = Number(callerId);
                    const callee = Number(calleeId);
                    const joinedUserId = Number(socketToUser.get(socket.id));
                    if (!caller || !callee || joinedUserId !== callee) return;

                    if (getActiveCallByUsers(caller, callee)) {
                        socket.emit('video_call_error', { message: 'A video call is already active for this pair.' });
                        return;
                    }

                    const quota = await getQuotaStatusForUsers(caller, callee);
                    if (quota.totalRemainingSeconds <= 0) {
                        io.to(String(caller)).emit('video_call_error', {
                            message: 'Free 5 minutes are used. Please purchase 1-hour package (600,000 VND).'
                        });
                        io.to(String(callee)).emit('video_call_error', {
                            message: 'Client needs to purchase video package to continue.'
                        });
                        return;
                    }

                    const startedAt = Date.now();
                    const key = getPairKey(caller, callee);

                    const timeoutRef = setTimeout(async () => {
                        io.to(String(caller)).emit('video_call_limit_reached', { message: 'Call time limit reached.' });
                        io.to(String(callee)).emit('video_call_limit_reached', { message: 'Call time limit reached.' });
                        await finalizeVideoCall(caller, callee, 'limit_reached', null);
                    }, quota.totalRemainingSeconds * 1000);

                    activeVideoCalls.set(key, {
                        callerId: caller,
                        calleeId: callee,
                        startedAt,
                        timeoutRef,
                        allowedSeconds: quota.totalRemainingSeconds
                    });

                    io.to(String(caller)).emit('video_call_started', {
                        callerId: caller,
                        calleeId: callee,
                        allowedSeconds: quota.totalRemainingSeconds,
                        startedAt
                    });
                    io.to(String(callee)).emit('video_call_started', {
                        callerId: caller,
                        calleeId: callee,
                        allowedSeconds: quota.totalRemainingSeconds,
                        startedAt
                    });
                } catch (error) {
                    socket.emit('video_call_error', { message: error.message || 'Cannot start video call' });
                }
            });

            socket.on('video_call_end', async ({ peerId } = {}) => {
                const me = Number(socketToUser.get(socket.id));
                const peer = Number(peerId);
                if (!me || !peer) return;
                await finalizeVideoCall(me, peer, 'ended', me);
            });

            socket.on('video_call_resume_request', ({ userId, partnerId } = {}) => {
                const me = Number(userId);
                const partner = Number(partnerId);
                const joinedUserId = Number(socketToUser.get(socket.id));
                if (!me || !partner || joinedUserId !== me) return;

                const existingCall = getActiveCallByUsers(me, partner);
                if (!existingCall) {
                    socket.emit('video_call_error', { message: 'Cuộc gọi không còn hoạt động.' });
                    return;
                }

                const payload = buildStartedPayload(existingCall);
                io.to(String(existingCall.callerId)).emit('video_call_started', payload);
                io.to(String(existingCall.calleeId)).emit('video_call_started', payload);
            });

            socket.on('webrtc_offer', ({ toUserId, sdp } = {}) => {
                const from = Number(socketToUser.get(socket.id));
                const to = Number(toUserId);
                if (!from || !to || !sdp || !getActiveCallByUsers(from, to)) return;

                io.to(String(to)).emit('webrtc_offer', { fromUserId: from, sdp });
            });

            socket.on('webrtc_answer', ({ toUserId, sdp } = {}) => {
                const from = Number(socketToUser.get(socket.id));
                const to = Number(toUserId);
                if (!from || !to || !sdp || !getActiveCallByUsers(from, to)) return;

                io.to(String(to)).emit('webrtc_answer', { fromUserId: from, sdp });
            });

            socket.on('webrtc_ice_candidate', ({ toUserId, candidate } = {}) => {
                const from = Number(socketToUser.get(socket.id));
                const to = Number(toUserId);
                if (!from || !to || !candidate || !getActiveCallByUsers(from, to)) return;

                io.to(String(to)).emit('webrtc_ice_candidate', { fromUserId: from, candidate });
            });

            socket.on('disconnect', () => {
                const userId = socketToUser.get(socket.id);
                socketToUser.delete(socket.id);
                if (!userId) return;

                const sockets = onlineUsers.get(userId);
                if (!sockets) return;

                sockets.delete(socket.id);
                if (sockets.size === 0) {
                    onlineUsers.delete(userId);
                    const lastSeen = new Date().toISOString();
                    lastSeenMap.set(userId, lastSeen);

                    io.emit('presence_update', {
                        userId: Number(userId),
                        isOnline: false,
                        lastSeen
                    });

                    const graceTimeoutRef = setTimeout(() => {
                        const stillOffline = !onlineUsers.has(userId);
                        disconnectGraceTimers.delete(userId);
                        if (!stillOffline) return;

                        const activeCalls = [...activeVideoCalls.values()].filter(
                            (call) => Number(call.callerId) === Number(userId) || Number(call.calleeId) === Number(userId)
                        );
                        activeCalls.forEach((call) => {
                            finalizeVideoCall(call.callerId, call.calleeId, 'disconnect', Number(userId)).catch(() => { });
                        });
                    }, 7000);

                    disconnectGraceTimers.set(userId, graceTimeoutRef);
                }
            });
        });

        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server đang chạy tại http://0.0.0.0:${PORT}`);
            console.log(`📱 Truy cập từ máy ảo Android qua: http://10.0.2.2:${PORT}`);
            console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);

            // Chạy trình quét lịch bị lỡ và gửi nhắc nhở mỗi 10 phút
            setInterval(async () => {
                console.log('[Cleaner] Running scheduled consultation cleanup & reminders...');
                await autoExpireConsultations();
                await notifyUpcomingConsultations(io);
            }, 10 * 60 * 1000);
        });
    } catch (error) {
        console.error('❌ Lỗi khởi động server:', error);
        process.exit(1);
    }
};

startServer();

module.exports = app;
