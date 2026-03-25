import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Smartphone, Send, CheckCircle2, XCircle, Clock, Server, AlertCircle, RefreshCw, FileSpreadsheet, Users } from 'lucide-react';
import Papa from 'papaparse';
import { cn } from './lib/utils';

interface Device {
  deviceId: string;
  model: string;
  type: string;
  status: string;
}

interface Task {
  id: string;
  targetDeviceId: string;
  phoneNumber: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  timestamp: Date;
  error?: string;
}

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const [batchMode, setBatchMode] = useState(false);
  const [csvContacts, setCsvContacts] = useState<string[]>([]);
  const [csvFileName, setCsvFileName] = useState<string>('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Connect to the same host
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('request_device_list');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('update_device_list', (updatedDevices: Device[]) => {
      setDevices(updatedDevices);
      // If selected device is no longer online, deselect it
      if (selectedDevice && !updatedDevices.find(d => d.deviceId === selectedDevice)) {
        setSelectedDevice('');
      }
    });

    newSocket.on('sms_task_update', (report: any) => {
      setTasks(prev => prev.map(task => 
        task.id === report.taskId 
          ? { ...task, status: report.status, error: report.error } 
          : task
      ));
    });

    newSocket.on('task_error', (report: any) => {
      setTasks(prev => prev.map(task => 
        task.id === report.taskId 
          ? { ...task, status: 'failed', error: report.error } 
          : task
      ));
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tasks]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (results) => {
        const numbers: string[] = [];
        results.data.forEach((row: any) => {
          if (Array.isArray(row)) {
            // Assume first column is phone number
            const val = row[0];
            if (val && typeof val === 'string' && val.trim()) {
              // Skip header row if it says "phone" or "电话"
              const lower = val.trim().toLowerCase();
              if (lower !== 'phone' && lower !== 'phonenumber' && lower !== '电话') {
                numbers.push(val.trim());
              }
            }
          }
        });
        setCsvContacts(numbers);
      }
    });
  };

  const handleSendTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !selectedDevice || !message) return;
    if (!batchMode && !phoneNumber) return;
    if (batchMode && csvContacts.length === 0) return;

    const targets = batchMode ? csvContacts : [phoneNumber];
    setIsSending(true);

    targets.forEach((phone, index) => {
      // Add slight delay between emits to avoid overwhelming the socket/server
      setTimeout(() => {
        const taskId = typeof crypto !== 'undefined' && crypto.randomUUID 
          ? crypto.randomUUID() 
          : `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
          
        const newTask: Task = {
          id: taskId,
          targetDeviceId: selectedDevice,
          phoneNumber: phone,
          message,
          status: 'pending',
          timestamp: new Date()
        };

        setTasks(prev => [...prev, newTask]);

        socket.emit('send_sms_task', {
          taskId,
          targetDeviceId: selectedDevice,
          phoneNumber: phone,
          message
        });
      }, index * 100); // 100ms delay per message
    });

    // Reset form but keep selected device
    if (!batchMode) setPhoneNumber('');
    setMessage('');
    
    // Simulate network delay for UI feedback
    setTimeout(() => setIsSending(false), targets.length * 100 + 500);
  };

  // For testing purposes: simulate a device connecting
  const simulateDevice = () => {
    if (!socket) return;
    const mockId = Math.random().toString(36).substring(2, 10);
    socket.emit('register_device', {
      deviceId: `mock-${mockId}`,
      model: `Test Phone ${Math.floor(Math.random() * 10)}`,
    });
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-blue-200">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <Send className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">SMS Gateway Console</h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={simulateDevice}
              className="text-xs font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-600 px-3 py-1.5 rounded-md transition-colors"
            >
              Simulate Device
            </button>
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="text-neutral-500">Server Status:</span>
              {isConnected ? (
                <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Disconnected
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Devices & Compose */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Online Devices Panel */}
            <section className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col h-[300px]">
              <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                <h2 className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                  <Server className="w-4 h-4 text-neutral-400" />
                  Online Devices
                  <span className="bg-blue-100 text-blue-700 py-0.5 px-2 rounded-full text-xs font-bold ml-2">
                    {devices.length}
                  </span>
                </h2>
                <button 
                  onClick={() => socket?.emit('request_device_list')}
                  className="text-neutral-400 hover:text-neutral-600 transition-colors"
                  title="Refresh list"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2">
                {devices.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-neutral-400 p-6 text-center">
                    <Smartphone className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-sm">No devices connected.</p>
                    <p className="text-xs mt-1 opacity-70">Open the Android app to connect.</p>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {devices.map((device) => (
                      <li key={device.deviceId}>
                        <button
                          onClick={() => setSelectedDevice(device.deviceId)}
                          className={cn(
                            "w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all",
                            selectedDevice === device.deviceId 
                              ? "bg-blue-50 border border-blue-200 shadow-sm" 
                              : "hover:bg-neutral-50 border border-transparent"
                          )}
                        >
                          <div className={cn(
                            "p-2 rounded-full",
                            selectedDevice === device.deviceId ? "bg-blue-100 text-blue-600" : "bg-neutral-100 text-neutral-500"
                          )}>
                            <Smartphone className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm font-medium truncate",
                              selectedDevice === device.deviceId ? "text-blue-900" : "text-neutral-700"
                            )}>
                              {device.model}
                            </p>
                            <p className="text-xs text-neutral-400 font-mono truncate">
                              ID: {device.deviceId}
                            </p>
                          </div>
                          {selectedDevice === device.deviceId && (
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Compose SMS Panel */}
            <section className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50/50">
                <h2 className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                  <Send className="w-4 h-4 text-neutral-400" />
                  Compose Message
                </h2>
              </div>
              
              <form onSubmit={handleSendTask} className="p-5 space-y-4">
                {/* Mode Toggle */}
                <div className="flex bg-neutral-100 p-1 rounded-lg">
                  <button 
                    type="button" 
                    onClick={() => setBatchMode(false)} 
                    className={cn("flex-1 flex items-center justify-center gap-2 text-xs font-medium py-2 rounded-md transition-all", !batchMode ? "bg-white shadow-sm text-blue-700" : "text-neutral-500 hover:text-neutral-700")}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Single SMS
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setBatchMode(true)} 
                    className={cn("flex-1 flex items-center justify-center gap-2 text-xs font-medium py-2 rounded-md transition-all", batchMode ? "bg-white shadow-sm text-blue-700" : "text-neutral-500 hover:text-neutral-700")}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Batch (CSV)
                  </button>
                </div>

                <div>
                  <label htmlFor="targetDevice" className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">
                    Target Device
                  </label>
                  <div className="relative">
                    <select
                      id="targetDevice"
                      value={selectedDevice}
                      onChange={(e) => setSelectedDevice(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none transition-shadow"
                      required
                    >
                      <option value="" disabled>Select a device to send from...</option>
                      {devices.map(d => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.model} ({d.deviceId.substring(0, 8)}...)
                        </option>
                      ))}
                    </select>
                    <Smartphone className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                  </div>
                </div>

                {!batchMode ? (
                  <div>
                    <label htmlFor="phoneNumber" className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">
                      Recipient Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phoneNumber"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                      required={!batchMode}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">
                      Upload Recipients (CSV)
                    </label>
                    <div className={cn(
                      "border-2 border-dashed rounded-lg p-6 text-center transition-colors relative",
                      csvContacts.length > 0 ? "border-emerald-200 bg-emerald-50/50" : "border-neutral-200 hover:bg-neutral-50"
                    )}>
                      <input 
                        type="file" 
                        accept=".csv" 
                        onChange={handleFileUpload} 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                        required={batchMode && csvContacts.length === 0}
                      />
                      <FileSpreadsheet className={cn("w-8 h-8 mx-auto mb-3", csvContacts.length > 0 ? "text-emerald-500" : "text-neutral-400")} />
                      {csvFileName ? (
                        <>
                          <p className="text-sm font-medium text-neutral-800">{csvFileName}</p>
                          <p className="text-xs font-bold text-emerald-600 mt-1.5 bg-emerald-100 inline-block px-2 py-0.5 rounded-full">
                            {csvContacts.length} numbers loaded
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-neutral-700">Click or drag CSV file here</p>
                          <p className="text-xs text-neutral-500 mt-1">First column should contain phone numbers</p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="message" className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">
                    Message Content
                  </label>
                  <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message here..."
                    rows={4}
                    className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-shadow"
                    required
                  />
                  <div className="mt-2 flex justify-between items-center text-xs text-neutral-400">
                    <span>{message.length} characters</span>
                    <span>{Math.ceil(message.length / 160) || 1} SMS part(s)</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!selectedDevice || (!batchMode && !phoneNumber) || (batchMode && csvContacts.length === 0) || !message || !isConnected || isSending}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-200 disabled:text-neutral-400 text-white font-medium py-2.5 px-4 rounded-lg transition-all active:scale-[0.98]"
                >
                  {isSending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {isSending ? 'Sending Tasks...' : `Send SMS Task${batchMode ? 's' : ''}`}
                </button>
              </form>
            </section>
          </div>

          {/* Right Column: Task History */}
          <div className="lg:col-span-7">
            <section className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-8rem)]">
              <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50/50 flex justify-between items-center">
                <h2 className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-neutral-400" />
                  Task History
                </h2>
                {tasks.length > 0 && (
                  <button 
                    onClick={() => setTasks([])}
                    className="text-xs text-neutral-500 hover:text-neutral-800 transition-colors"
                  >
                    Clear History
                  </button>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto p-5 bg-neutral-50/30">
                {tasks.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-neutral-400 text-center">
                    <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
                      <Clock className="w-6 h-6 text-neutral-300" />
                    </div>
                    <p className="text-sm font-medium text-neutral-600">No tasks yet</p>
                    <p className="text-xs mt-1 max-w-[200px]">Tasks you send will appear here with their delivery status.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tasks.map((task) => (
                      <div 
                        key={task.id} 
                        className={cn(
                          "bg-white border rounded-xl p-4 shadow-sm transition-all",
                          task.status === 'sent' ? "border-emerald-200" :
                          task.status === 'failed' ? "border-red-200" :
                          "border-blue-200"
                        )}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            {task.status === 'sent' ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : task.status === 'failed' ? (
                              <XCircle className="w-5 h-5 text-red-500" />
                            ) : (
                              <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                            )}
                            <div>
                              <p className="text-sm font-semibold text-neutral-800">
                                To: {task.phoneNumber}
                              </p>
                              <p className="text-xs text-neutral-500">
                                {task.timestamp.toLocaleTimeString()} • via {devices.find(d => d.deviceId === task.targetDeviceId)?.model || 'Unknown Device'}
                              </p>
                            </div>
                          </div>
                          <span className={cn(
                            "text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full",
                            task.status === 'sent' ? "bg-emerald-100 text-emerald-700" :
                            task.status === 'failed' ? "bg-red-100 text-red-700" :
                            "bg-blue-100 text-blue-700"
                          )}>
                            {task.status}
                          </span>
                        </div>
                        
                        <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-100">
                          <p className="text-sm text-neutral-700 whitespace-pre-wrap font-mono">
                            {task.message}
                          </p>
                        </div>
                        
                        {task.error && (
                          <div className="mt-3 flex items-start gap-1.5 text-xs text-red-600 bg-red-50 p-2 rounded-md">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <p>{task.error}</p>
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            </section>
          </div>
          
        </div>
      </main>
    </div>
  );
}
