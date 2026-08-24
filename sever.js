const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Phục vụ file tĩnh
app.use(express.static('public'));

// Lưu trữ
const users = {};
const admins = {};
const pendingRequests = {};

io.on('connection', (socket) => {
    console.log(`🟢 Client: ${socket.id}`);

    socket.on('register', (role) => {
        if (role === 'user') {
            users[socket.id] = socket;
            console.log(`👤 User: ${socket.id}`);
        } else if (role === 'admin') {
            admins[socket.id] = socket;
            console.log(`👨‍💼 Admin: ${socket.id}`);
            socket.emit('admin-stats', {
                totalUsers: Object.keys(users).length,
                pendingRequests: Object.keys(pendingRequests).length
            });
        }
    });

    socket.on('user-withdraw', (data) => {
        const requestId = `req_${Date.now()}`;
        const requestData = {
            id: requestId,
            userId: data.userId,
            userKey: data.userKey || data.userId,
            amount: data.amount,
            zaloName: data.zaloName || 'Chưa có',
            zaloPhone: data.zaloPhone || 'Chưa có',
            time: new Date().toLocaleString('vi-VN'),
            status: 'pending',
            historyIdx: data.historyIdx || 0
        };
        pendingRequests[requestId] = requestData;
        
        console.log(`💰 ${data.userId} rút ${data.amount.toLocaleString()}đ`);
        
        socket.emit('withdraw-response', {
            success: true,
            message: 'Đã gửi yêu cầu!'
        });
        
        Object.keys(admins).forEach(adminId => {
            admins[adminId].emit('admin-notification', requestData);
        });
    });

    socket.on('admin-action', (data) => {
        const request = pendingRequests[data.requestId];
        if (request) {
            const userSocket = users[data.userId];
            if (userSocket) {
                userSocket.emit('withdraw-result', {
                    status: data.action === 'approve' ? 'approved' : 'rejected',
                    amount: request.amount,
                    message: data.action === 'approve' ? '✅ Rút tiền thành công!' : '❌ Rút tiền bị từ chối!'
                });
                delete pendingRequests[data.requestId];
                socket.emit('admin-action-result', {
                    success: true,
                    message: `Đã ${data.action === 'approve' ? 'duyệt' : 'từ chối'}`
                });
            }
        }
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        delete admins[socket.id];
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server: http://localhost:${PORT}`);
});