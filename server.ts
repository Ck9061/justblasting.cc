import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Store online devices: { socketId: { deviceId, model, status, type } }
  let onlineDevices: Record<string, any> = {};

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // 1. Device Registration
    socket.on('register_device', (data) => {
      onlineDevices[socket.id] = {
        deviceId: data.deviceId,
        model: data.model,
        type: 'phone',
        status: 'online'
      };
      console.log(`Device online: ${data.model} (${data.deviceId})`);
      io.emit('update_device_list', Object.values(onlineDevices)); // Notify console
    });

    // 2. Console sends SMS task
    socket.on('send_sms_task', (task) => {
      // Find the target phone's socket
      const targetSocketId = Object.keys(onlineDevices).find(
        id => onlineDevices[id].deviceId === task.targetDeviceId
      );

      // Ensure a unique taskId is generated and sent with the task
      const taskId = task.taskId || `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      if (targetSocketId) {
        console.log(`Sending SMS task [${taskId}] to ${task.targetDeviceId}`);
        io.to(targetSocketId).emit('execute_sms', {
          phoneNumber: task.phoneNumber,
          message: task.message,
          taskId: taskId
        });
      } else {
        // Notify sender that device is offline
        socket.emit('task_error', {
          taskId: taskId,
          error: 'Target device is offline or not found.'
        });
      }
    });

    // 3. Phone reports SMS status
    socket.on('sms_status_report', (report) => {
      console.log(`SMS Status from ${report.deviceId}: ${report.status}`);
      // Broadcast to console
      io.emit('sms_task_update', report);
    });

    // 4. Request device list (for newly connected consoles)
    socket.on('request_device_list', () => {
      socket.emit('update_device_list', Object.values(onlineDevices));
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      if (onlineDevices[socket.id]) {
        delete onlineDevices[socket.id];
        io.emit('update_device_list', Object.values(onlineDevices));
      }
    });
  });

  // API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', devices: Object.keys(onlineDevices).length });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
