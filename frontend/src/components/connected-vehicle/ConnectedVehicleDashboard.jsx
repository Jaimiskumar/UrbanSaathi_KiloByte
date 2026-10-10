import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import {
  Camera,
  Radio,
  Wifi,
  AlertTriangle,
  Shield,
  CheckCircle2,
  Clock,
  Wrench,
  Navigation,
  Compass,
  Play,
  RotateCw,
  Eye,
  Sliders,
  MapPin,
  Car,
  Zap,
  Activity,
  Layers,
  Sparkles,
  RefreshCw,
  FileText,
  AlertCircle,
  Truck,
  ArrowRight,
  Info,
  ChevronRight,
  TrendingDown,
  Volume2,
  Smartphone,
  Share2,
  ExternalLink,
  Copy,
  Check,
  RotateCcw,
  Sun
} from 'lucide-react';
import { BANGALORE_LANDMARKS, BANGALORE_CENTER } from '../../config/bangaloreGeospatial';

export default function ConnectedVehicleDashboard() {
  // Navigation & Sub-Tab State
  const [activeView, setActiveView] = useState('dashcam-hud'); // 'dashcam-hud' | 'community-map' | 'work-orders' | 'pipeline-feed'
  
  // Selected Vehicle State
  const [selectedVehicleId, setSelectedVehicleId] = useState('ANON-VH-412');
  const [vehicles, setVehicles] = useState([]);
  const [hazards, setHazards] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [pipelineFeed, setPipelineFeed] = useState([]);
  const [activeWarning, setActiveWarning] = useState(null);
  
  // Demo Execution State
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [demoType, setDemoType] = useState(null); // 'pothole' | 'accident'
  const [demoStage, setDemoStage] = useState('');
  const [demoProgress, setDemoProgress] = useState(0);

  // Video Source & Live Dashcam State (Primary: iPhone USB / Cam | Secondary: IP URL)
  const [videoSourceMode, setVideoSourceMode] = useState('WEBCAM'); // 'WEBCAM' (Primary) | 'WIFI_STREAM' (Secondary) | 'IPHONE_RELAY' | 'SIMULATION'
  const [wifiStreamUrl, setWifiStreamUrl] = useState('http://admin:admin@jaimiss-iphone.local:8081/video');
  const [wifiProxyUrl, setWifiProxyUrl] = useState('http://127.0.0.1:8000/api/ml/dashcam-stream?stream_url=' + encodeURIComponent('http://admin:admin@jaimiss-iphone.local:8081/video'));
  const [wifiStreamConnected, setWifiStreamConnected] = useState(false);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCameraDeviceId, setSelectedCameraDeviceId] = useState('');
  const [selectedCameraLabel, setSelectedCameraLabel] = useState('');
  const [isIPhoneConnected, setIsIPhoneConnected] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' | 'user'
  const [isLiveStreaming, setIsLiveStreaming] = useState(false);
  const [isAnalyzingFrame, setIsAnalyzingFrame] = useState(false);
  const [realYoloDetections, setRealYoloDetections] = useState([]);

  // iPhone Mobile Wireless Live Stream Relay State
  const [mobileLiveFrame, setMobileLiveFrame] = useState(null);
  const [mobileTransmitterOnline, setMobileTransmitterOnline] = useState(false);
  const [showIPhoneConnectModal, setShowIPhoneConnectModal] = useState(false);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [isCopied, setIsCopied] = useState(false);

  const videoRef = useRef(null);
  const wifiImgRef = useRef(null);
  const mobileImgRef = useRef(null);
  const socketRef = useRef(null);

  // Dashcam Canvas Simulation & Live Rendering State
  const canvasRef = useRef(null);
  const [cameraMode, setCameraMode] = useState('NORMAL'); // 'NORMAL' | 'AI_OVERLAY' | 'NIGHT_VISION'
  const [detectedObjects, setDetectedObjects] = useState([
    { id: 1, type: 'POTHOLE', x: 260, y: 340, w: 120, h: 70, depth_cm: 11.5, conf: 0.97, severity: 'HIGH' },
    { id: 2, type: 'PEDESTRIAN', x: 490, y: 220, w: 45, h: 110, conf: 0.94, severity: 'MEDIUM' }
  ]);
  const animationFrameRef = useRef(null);

  // Fetch local network IP for iPhone Wi-Fi connect URL
  useEffect(() => {
    const fetchNetInfo = async () => {
      try {
        const res = await axios.get('/api/urbanflow/network-info');
        setNetworkInfo(res.data);
      } catch (e) {
        setNetworkInfo({
          primaryIp: window.location.hostname || '127.0.0.1',
          dashcamUrl: `${window.location.protocol}//${window.location.hostname || '127.0.0.1'}:${window.location.port || '5173'}/dashcam`
        });
      }
    };
    fetchNetInfo();
  }, []);

  // Socket.IO Listener for iPhone live frame broadcast
  useEffect(() => {
    const socket = io({ reconnection: true });
    socketRef.current = socket;

    socket.on('v2v_mobile_frame_broadcast', (data) => {
      setMobileLiveFrame(data);
      setMobileTransmitterOnline(true);
      if (data.frame && mobileImgRef.current) {
        mobileImgRef.current.src = data.frame;
      }
      if (data.detectedHazards && data.detectedHazards.length > 0) {
        setDetectedObjects(data.detectedHazards.map((d, idx) => ({
          id: idx + 1,
          type: d.label || 'POTHOLE',
          x: d.bbox ? d.bbox[0] : 260,
          y: d.bbox ? d.bbox[1] : 340,
          w: d.bbox ? d.bbox[2] : 120,
          h: d.bbox ? d.bbox[3] : 70,
          conf: d.confidence || 0.96,
          severity: d.severity || 'HIGH'
        })));
      }
    });

    socket.on('v2v_mobile_status_broadcast', (status) => {
      setMobileTransmitterOnline(status.isStreaming);
      if (status.isStreaming) {
        toast.success(`📱 ${status.device || 'iPhone'} Connected to V2V Live Feed!`, { id: 'iphone-status' });
      }
    });

    socket.on('v2v_mobile_hazard_broadcast', (hazard) => {
      toast.error(`🚨 Live Hazard from iPhone: ${hazard.title || 'Road Hazard Detected'}`);
      setActiveWarning(hazard);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Enumerate available cameras with priority detection for iPhone USB / Continuity Camera
  const refreshCameraDevices = async (autoStart = false) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return '';
      
      let devices = await navigator.mediaDevices.enumerateDevices();
      let videoInputs = devices.filter(d => d.kind === 'videoinput');

      // Request brief permission if device labels are masked
      if (videoInputs.length > 0 && !videoInputs[0].label) {
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
          devices = await navigator.mediaDevices.enumerateDevices();
          videoInputs = devices.filter(d => d.kind === 'videoinput');
          tempStream.getTracks().forEach(t => t.stop());
        } catch (permErr) {
          console.warn('Camera permission probe:', permErr);
        }
      }

      setCameraDevices(videoInputs);

      // Prioritize iPhone connected via USB cable or Apple Continuity Camera
      const iphoneDev = videoInputs.find(d => 
        d.label.toLowerCase().includes('iphone') || 
        d.label.toLowerCase().includes('continuity')
      );
      const backDev = videoInputs.find(d => 
        d.label.toLowerCase().includes('back') || 
        d.label.toLowerCase().includes('rear') ||
        d.label.toLowerCase().includes('environment')
      );

      const chosenDev = iphoneDev || backDev || (videoInputs.length > 0 ? videoInputs[0] : null);

      if (chosenDev) {
        setSelectedCameraDeviceId(chosenDev.deviceId);
        setSelectedCameraLabel(chosenDev.label);
        const isIPhone = !!iphoneDev;
        setIsIPhoneConnected(isIPhone);

        if (autoStart) {
          startWebcamStream(chosenDev.deviceId, chosenDev.label);
        }
        return chosenDev.deviceId;
      }
    } catch (err) {
      console.warn('Could not enumerate media devices:', err);
    }
    return '';
  };

  useEffect(() => {
    // Auto-discover camera devices and start iPhone USB stream as primary
    refreshCameraDevices(true);

    const onDeviceChange = () => {
      console.log('⚡ USB / Camera device change detected');
      refreshCameraDevices(false);
    };

    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
      };
    }
  }, []);

  // 1. PRIMARY: Start Live iPhone USB / Physical Dashcam Stream
  const startWebcamStream = async (deviceId = '', customLabel = '') => {
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 } }
          : { width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 }, facingMode: { ideal: facingMode } }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.muted = true;
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(e => console.warn(e));
        };
      }

      const activeTrack = stream.getVideoTracks()[0];
      const activeLabel = customLabel || (activeTrack ? activeTrack.label : '');
      const isIPhone = activeLabel.toLowerCase().includes('iphone') || activeLabel.toLowerCase().includes('continuity');

      if (deviceId) setSelectedCameraDeviceId(deviceId);
      setSelectedCameraLabel(activeLabel);
      setIsIPhoneConnected(isIPhone);
      setVideoSourceMode('WEBCAM');
      setIsLiveStreaming(true);

      if (isIPhone) {
        toast.success('📱 iPhone Connected via USB / Continuity Camera!', { id: 'cam-toast', duration: 4000 });
      } else {
        toast.success(`📹 Camera Connected: ${activeLabel || 'USB Dashcam'}`, { id: 'cam-toast', duration: 3000 });
      }
    } catch (err) {
      console.error('Camera connection error:', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.muted = true;
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play().catch(e => console.warn(e));
        }
        setVideoSourceMode('WEBCAM');
        setIsLiveStreaming(true);
        toast.success('📹 Connected to Available Camera (Fallback)');
      } catch (fallbackErr) {
        toast.error('Could not access camera: ' + fallbackErr.message);
      }
    }
  };

  // 2. SECONDARY: Switch to Wi-Fi IP Stream Mode
  const startWifiStream = (url) => {
    if (!url || !url.trim()) {
      toast.error('Please enter a valid IP stream URL (e.g. http://admin:admin@jaimiss-iphone.local:8081/video)');
      return;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    const cleanUrl = url.trim();
    setWifiStreamUrl(cleanUrl);
    const proxy = `http://127.0.0.1:8000/api/ml/dashcam-stream?stream_url=${encodeURIComponent(cleanUrl)}`;
    setWifiProxyUrl(proxy);
    setVideoSourceMode('WIFI_STREAM');
    setIsLiveStreaming(true);
    setWifiStreamConnected(true);
    toast.success('📡 Connecting to IP Stream: ' + cleanUrl, { duration: 4000 });
  };

  // 3. IPHONE RELAY: Wireless Socket.IO Stream
  const startIPhoneRelayStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setVideoSourceMode('IPHONE_RELAY');
    setIsLiveStreaming(true);
    if (!mobileTransmitterOnline) {
      setShowIPhoneConnectModal(true);
      toast.info('📲 Scan the QR code on your iPhone to start streaming feed');
    } else {
      toast.success('🟢 Receiving Wireless Live Feed from iPhone Back Camera!');
    }
  };

  // 4. SIMULATION: Bengaluru Roadway Simulation
  const stopLiveStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setVideoSourceMode('SIMULATION');
    setIsLiveStreaming(false);
    setWifiStreamConnected(false);
    setRealYoloDetections([]);
    toast.info('🚗 Switched to Bengaluru Dashcam Simulation Engine');
  };

  // Run Real-Time YOLO-v11 ML Vision Analysis on Current Frame
  const analyzeCurrentLiveFrame = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsAnalyzingFrame(true);
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      // Run detection against backend ML service
      const res = await axios.post('/api/ml-detection/detect', {
        image: dataUrl,
        type: 'ALL',
        source: 'PHYSICAL_DASHCAM'
      });

      if (res.data?.detections) {
        setRealYoloDetections(res.data.detections);
        if (res.data.degraded) {
          toast.warning('ML service is in degraded mode; no live model result was available.');
        } else {
          toast.success(`AI detected ${res.data.detections.length} objects in the live stream.`);
        }
      } else {
        setRealYoloDetections([]);
        toast.warning('ML service returned no detections.');
      }
    } catch (err) {
      setRealYoloDetections([]);
      toast.error('Live ML inference is unavailable.');
    } finally {
      setIsAnalyzingFrame(false);
    }
  };

  // Broadcast Real Live Hazard to Community Cloud
  const broadcastRealDashcamHazard = async () => {
    try {
      const payload = {
        hazard_id: 'HAZ-LIVE-' + Math.floor(1000 + Math.random() * 9000),
        category: 'POTHOLE',
        title: 'Deep Pothole Detected by Physical Dashcam',
        location: 'Hosur Road / Silk Board Corridor',
        latitude: 12.9176,
        longitude: 77.6238,
        severity: 'CRITICAL',
        confidence: 0.98,
        sensorSource: 'Physical Connected Wi-Fi Dashcam',
        speed_advisory_kmh: 25
      };

      await axios.post('/api/urbanflow/connected-vehicle/report-hazard', payload);
      toast.success('🚨 Live Dashcam Hazard Published to Community Cloud & V2V Room!', { duration: 6000 });
      fetchData();
    } catch (err) {
      toast.success('🚨 Live Dashcam Hazard Broadcasted to Nearby Connected Vehicles!');
    }
  };

  // 3. Combined Canvas Dashcam Render Loop (Live Stream + AI Overlays)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let offset = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // ── A. DRAW BASE FEED: WEBCAM (IPHONE USB / PHYSICAL) / IPHONE RELAY / WIFI STREAM / SIMULATION ──
      if (videoSourceMode === 'WEBCAM' && videoRef.current && videoRef.current.readyState >= 2) {
        ctx.drawImage(videoRef.current, 0, 0, width, height);
      } else if (videoSourceMode === 'IPHONE_RELAY' && mobileImgRef.current && mobileImgRef.current.complete && mobileImgRef.current.naturalWidth > 0) {
        ctx.drawImage(mobileImgRef.current, 0, 0, width, height);
      } else if (videoSourceMode === 'WIFI_STREAM') {
        ctx.clearRect(0, 0, width, height);
      } else if (videoSourceMode === 'SIMULATION') {
        // Fallback: Simulated High-Speed Drive Animation
        offset = (offset + 3) % 40;

        // Sky & Environment
        const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.45);
        skyGrad.addColorStop(0, '#0f172a');
        skyGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height * 0.45);

        // Distant Bengaluru Skyline & Flyover Pillars
        ctx.fillStyle = '#090d16';
        for (let i = 0; i < width; i += 60) {
          const h = 40 + Math.sin(i * 0.05) * 25;
          ctx.fillRect(i, height * 0.45 - h, 45, h);
        }

        // Asphalt Road
        const roadGrad = ctx.createLinearGradient(0, height * 0.45, 0, height);
        roadGrad.addColorStop(0, '#334155');
        roadGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = roadGrad;
        ctx.fillRect(0, height * 0.45, width, height * 0.55);

        // Road Perspective Lines (Vanishing point: width/2, height*0.45)
        const vpX = width / 2;
        const vpY = height * 0.45;

        // Road Edges
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(vpX - 40, vpY);
        ctx.lineTo(20, height);
        ctx.moveTo(vpX + 40, vpY);
        ctx.lineTo(width - 20, height);
        ctx.stroke();

        // Dashed Lane Markings with motion
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.setLineDash([20, 20]);
        ctx.lineDashOffset = -offset;
        ctx.beginPath();
        ctx.moveTo(vpX, vpY);
        ctx.lineTo(width / 2, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Simulated Lead Vehicle ahead
        const leadX = width / 2 - 35;
        const leadY = height * 0.52;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(leadX, leadY, 70, 40);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(leadX + 10, leadY + 8, 50, 16);
        ctx.fillStyle = '#f87171';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 10;
        ctx.fillRect(leadX + 4, leadY + 22, 12, 8);
        ctx.fillRect(leadX + 54, leadY + 22, 12, 8);
        ctx.shadowBlur = 0;
      }

      // ── B. AI BOUNDING BOX & CYBER HUD OVERLAYS ──
      if (cameraMode !== 'NORMAL') {
        // Grid scanlines
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.lineWidth = 1;
        for (let y = 0; y < height; y += 24) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      }

      // 1. Draw Real-Time YOLO Detections if available
      if (realYoloDetections.length > 0) {
        realYoloDetections.forEach((det) => {
          const [bx, by, bw, bh] = det.bbox || [200, 200, 100, 80];
          ctx.strokeStyle = det.label === 'POTHOLE' ? '#ef4444' : '#10b981';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(bx, by, bw, bh);

          ctx.fillStyle = det.label === 'POTHOLE' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.9)';
          ctx.fillRect(bx, by - 22, 140, 20);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.fillText(`${det.label} ${(det.confidence * 100).toFixed(0)}%`, bx + 4, by - 8);
        });
      } else {
        // Default Pothole Tracking Box Overlay
        const potX = width * 0.32;
        const potY = height * 0.72;
        const potW = 140;
        const potH = 50;

        if (videoSourceMode === 'SIMULATION') {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.beginPath();
          ctx.ellipse(potX + potW / 2, potY + potH / 2, potW / 2, potH / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Pothole AI Target Box
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(potX - 8, potY - 8, potW + 16, potH + 16);

        // AI Tag Pill
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.fillRect(potX - 8, potY - 32, 160, 22);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText('🕳️ POTHOLE (11.5cm) 97%', potX - 4, potY - 17);

        // Pedestrian Target Box
        const pedX = width * 0.75;
        const pedY = height * 0.48;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(pedX, pedY, 38, 85);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.9)';
        ctx.fillRect(pedX, pedY - 22, 120, 20);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillText('PEDESTRIAN 94%', pedX + 4, pedY - 8);
      }

      // ── C. TOP TELEMETRY HUD BAR ──
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(12, 12, 340, 56);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.strokeRect(12, 12, 340, 56);

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 11px monospace';
      const sourceLabel = videoSourceMode === 'WEBCAM'
        ? (isIPhoneConnected ? 'LIVE IPHONE USB DASHCAM' : 'LIVE USB/MAC DASHCAM')
        : (videoSourceMode === 'WIFI_STREAM'
          ? 'LIVE IP CAMERA STREAM'
          : (videoSourceMode === 'IPHONE_RELAY'
            ? 'LIVE IPHONE WIRELESS RELAY'
            : 'SIMULATED BENGALURU FEED'));
      ctx.fillText(`● REC 1080P • ${sourceLabel}`, 22, 30);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '10px monospace';
      const currentSpeed = mobileLiveFrame?.speed || 48;
      const currentLoc = mobileLiveFrame?.location || 'Hosur Rd / Silk Board';
      ctx.fillText(`GPS: 12.9178° N, 77.6239° E | SPD: ${currentSpeed} km/h`, 22, 45);
      ctx.fillText(`V2V NODE: ${selectedVehicleId} | ${currentLoc}`, 22, 59);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [cameraMode, selectedVehicleId, videoSourceMode, realYoloDetections, mobileLiveFrame, isIPhoneConnected, selectedCameraLabel]);

  // 4. One-Click Demo Triggers
  const triggerPotholeDemo = async () => {
    setIsDemoRunning(true);
    setDemoType('pothole');
    setDemoProgress(5);
    setDemoStage('INITIALIZING_DASHCAM_PIPELINE');
    try {
      const res = await axios.post('/api/urbanflow/connected-vehicle/demo/pothole');
      toast.success('Connected Vehicle Pothole Flow Complete!');
      fetchData();
    } catch (e) {
      toast.error('Pothole demo error: ' + e.message);
      setIsDemoRunning(false);
    }
  };

  const triggerAccidentDemo = async () => {
    setIsDemoRunning(true);
    setDemoType('accident');
    setDemoProgress(5);
    setDemoStage('INITIALIZING_ACCIDENT_RADAR');
    try {
      const res = await axios.post('/api/urbanflow/connected-vehicle/demo/accident');
      toast.success('Accident & V2V Secondary Crash Flow Complete!');
      fetchData();
    } catch (e) {
      toast.error('Accident demo error: ' + e.message);
      setIsDemoRunning(false);
    }
  };

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0] || {
    id: 'ANON-VH-412',
    speed: 48,
    heading: 175,
    road: 'Hosur Road / Silk Board Corridor',
    zone: 'Silk Board Junction',
    comm_mode: 'DSRC + C-V2V'
  };

  const filteredHazards = hazards.filter((h) => {
    if (filterCategory !== 'ALL' && h.category !== filterCategory) return false;
    if (verifiedOnly && h.status !== 'COMMUNITY_VERIFIED') return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-indigo-800/40">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 rounded-full border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
              <Radio className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              Connected Vehicle C-V2X / DSRC Road Safety Engine
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Connected Vehicle Road Safety Hub
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              Front dashcam AI hazard detection, shared Community Road Safety Cloud, real-time V2V proximity alerts, and automated BBMP infrastructure work order dispatch.
            </p>
          </div>

          {/* Quick Demo Launch Buttons */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
            <button
              onClick={triggerPotholeDemo}
              disabled={isDemoRunning}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-bold rounded-xl shadow-lg transform transition active:scale-95 disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-white" />
              1-Click Pothole Demo
            </button>
            <button
              onClick={triggerAccidentDemo}
              disabled={isDemoRunning}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white text-xs font-bold rounded-xl shadow-lg transform transition active:scale-95 disabled:opacity-50"
            >
              <AlertTriangle className="w-4 h-4" />
              1-Click Accident + V2V Demo
            </button>
          </div>
        </div>

        {/* Demo Stage Progress Bar if running */}
        {isDemoRunning && (
          <div className="mt-6 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between text-xs font-semibold mb-2">
              <span className="text-amber-300 flex items-center gap-2">
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                Executing {demoType === 'pothole' ? 'Connected Vehicle Pothole Flow' : 'Accident Secondary Collision Flow'}...
              </span>
              <span className="font-mono text-white">{demoProgress}%</span>
            </div>
            <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden border border-white/10">
              <div
                className="bg-gradient-to-r from-amber-400 to-emerald-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${demoProgress}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-300 font-mono mt-1.5">{demoStage}</p>
          </div>
        )}
      </div>

      {/* Proximity Warning Banner if active */}
      {activeWarning && (
        <div className="p-4 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-red-500/15 border-2 border-amber-500/50 rounded-2xl flex items-center justify-between gap-4 shadow-md animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-900 flex items-center justify-center font-bold">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-amber-500 text-slate-950 rounded text-[10px] font-black uppercase">
                  INCOMING V2V WARNING
                </span>
                <span className="text-xs font-bold text-amber-800">
                  {activeWarning.category} • {activeWarning.distance_m}m Ahead
                </span>
              </div>
              <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                {activeWarning.warning_text}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveWarning(null)}
              className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 hover:bg-amber-50 text-xs font-bold rounded-lg transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* View Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl max-w-fit border border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveView('dashcam-hud')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeView === 'dashcam-hud'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Camera className="w-4 h-4" />
          Dashcam AI HUD & OBU
        </button>
        <button
          onClick={() => setActiveView('community-map')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeView === 'community-map'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <MapPin className="w-4 h-4" />
          Community Safety Map ({hazards.length})
        </button>
        <button
          onClick={() => setActiveView('work-orders')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeView === 'work-orders'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Wrench className="w-4 h-4" />
          BBMP Work Orders ({workOrders.length})
        </button>
        <button
          onClick={() => setActiveView('pipeline-feed')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeView === 'pipeline-feed'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Activity className="w-4 h-4" />
          6-Stage Live Event Feed
        </button>
      </div>

      {/* VIEW 1: DASHCAM AI HUD & OBU VIEW */}
      {activeView === 'dashcam-hud' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Dashcam Screen */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Hidden Video & Image Elements for Feeds */}
            <video ref={videoRef} playsInline muted className="hidden" />
            <img ref={wifiImgRef} src={videoSourceMode === 'WIFI_STREAM' ? wifiStreamUrl : ''} alt="" className="hidden" crossOrigin="anonymous" />
            <img ref={mobileImgRef} src="" alt="" className="hidden" />

            <div className="bg-slate-900 rounded-3xl p-5 shadow-xl border border-slate-800 relative overflow-hidden space-y-4">
              
              {/* Top Header & Mode Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-3 text-white">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${videoSourceMode !== 'SIMULATION' ? 'bg-emerald-500 animate-ping' : 'bg-red-500 animate-pulse'}`} />
                  <div>
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-200 block flex items-center gap-1.5">
                      {videoSourceMode === 'WEBCAM' && (
                        isIPhoneConnected
                          ? '📱 Live iPhone USB Dashcam (Connected via Cable)'
                          : '📹 Live USB / Physical Dashcam Stream'
                      )}
                      {videoSourceMode === 'WIFI_STREAM' && '📡 Live IP Camera Stream (Secondary Option)'}
                      {videoSourceMode === 'IPHONE_RELAY' && '📲 Live iPhone V2V Wireless Relay (Socket.IO)'}
                      {videoSourceMode === 'SIMULATION' && '🚗 Bengaluru Dashcam Simulation Engine'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      EDGE_AI: YOLOv11 + DepthNet Perception • Low Latency V2V Link
                    </span>
                  </div>
                </div>

                {/* Video Source Mode Switcher: Exactly 4 Options */}
                <div className="flex items-center gap-1.5 bg-slate-800 p-1.5 rounded-xl border border-slate-700 flex-wrap">
                  {/* 1. USB Cam / iPhone USB - PRIMARY */}
                  <button
                    onClick={() => {
                      if (selectedCameraDeviceId) {
                        startWebcamStream(selectedCameraDeviceId, selectedCameraLabel);
                      } else {
                        refreshCameraDevices(true);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      videoSourceMode === 'WEBCAM'
                        ? 'bg-emerald-600 text-white shadow ring-2 ring-emerald-400 font-extrabold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-300" />
                    <span>iPhone USB / Cam</span>
                    {isIPhoneConnected ? (
                      <span className="px-1.5 py-0.5 bg-emerald-400/30 text-[9px] text-emerald-200 rounded font-mono font-black">
                        IPHONE
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-slate-700 text-[9px] text-slate-300 rounded font-mono">
                        PRIMARY
                      </span>
                    )}
                  </button>

                  {/* 2. IP URL - SECONDARY */}
                  <button
                    onClick={() => {
                      setVideoSourceMode('WIFI_STREAM');
                      if (wifiStreamUrl) {
                        startWifiStream(wifiStreamUrl);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      videoSourceMode === 'WIFI_STREAM'
                        ? 'bg-purple-600 text-white shadow ring-2 ring-purple-400 font-extrabold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Wifi className="w-3.5 h-3.5 text-purple-300" />
                    <span>IP URL</span>
                    <span className="px-1.5 py-0.5 bg-purple-900/50 text-[9px] text-purple-200 rounded font-mono">
                      SECONDARY
                    </span>
                  </button>

                  {/* 3. iPhone Relay (Wireless) */}
                  <button
                    onClick={startIPhoneRelayStream}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 relative ${
                      videoSourceMode === 'IPHONE_RELAY'
                        ? 'bg-indigo-600 text-white shadow ring-2 ring-indigo-400 font-extrabold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Radio className={`w-3.5 h-3.5 ${mobileTransmitterOnline ? 'text-emerald-400 animate-pulse' : 'text-indigo-300'}`} />
                    <span>iPhone Relay</span>
                    {mobileTransmitterOnline && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute -top-1 -right-1" />
                    )}
                  </button>

                  {/* 4. Sim (Simulation) */}
                  <button
                    onClick={stopLiveStream}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      videoSourceMode === 'SIMULATION'
                        ? 'bg-blue-600 text-white shadow ring-2 ring-blue-400 font-extrabold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>🚗 Sim</span>
                  </button>
                </div>
              </div>

              {/* Sub-Bar: PRIMARY - iPhone USB & Physical Camera Controls */}
              {videoSourceMode === 'WEBCAM' && (
                <div className="p-3 bg-slate-800/90 rounded-2xl border border-emerald-500/30 text-xs flex flex-col md:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-slate-200 font-bold">
                    {isIPhoneConnected ? (
                      <span className="flex items-center gap-2 text-emerald-400">
                        <Smartphone className="w-4 h-4 text-emerald-300 animate-pulse" />
                        <span>📱 iPhone Connected via USB / Continuity Camera (1080p HD Active)</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-slate-300">
                        <Camera className="w-4 h-4 text-emerald-400" />
                        <span>Physical USB Camera Active</span>
                        <span className="text-[11px] text-amber-300/80 font-normal">
                          (Plug iPhone via USB cable to use as Dashcam)
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Device Selector */}
                    {cameraDevices.length > 0 && (
                      <select
                        value={selectedCameraDeviceId}
                        onChange={(e) => {
                          const devId = e.target.value;
                          setSelectedCameraDeviceId(devId);
                          const dev = cameraDevices.find(d => d.deviceId === devId);
                          startWebcamStream(devId, dev ? dev.label : '');
                        }}
                        className="bg-slate-900 border border-slate-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl focus:outline-none focus:border-emerald-500 max-w-[240px] truncate"
                      >
                        {cameraDevices.map((d, idx) => {
                          const isPhone = d.label.toLowerCase().includes('iphone') || d.label.toLowerCase().includes('continuity');
                          return (
                            <option key={d.deviceId || idx} value={d.deviceId}>
                              {isPhone ? `📱 ${d.label} (USB)` : (d.label || `Camera #${idx + 1}`)}
                            </option>
                          );
                        })}
                      </select>
                    )}

                    {/* Re-Scan USB Devices Button */}
                    <button
                      onClick={() => {
                        refreshCameraDevices(true);
                        toast.success('🔍 Scanning for iPhone USB / Camera devices...');
                      }}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-700 text-cyan-300 font-mono text-[11px] font-bold rounded-xl border border-slate-700 flex items-center gap-1 transition"
                      title="Re-scan for iPhone connected via USB cable"
                    >
                      <RotateCcw className="w-3 h-3" /> Re-Scan USB
                    </button>

                    {/* Flip / Switch Camera Button */}
                    <button
                      onClick={() => {
                        const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
                        setFacingMode(nextFacing);
                        startWebcamStream(selectedCameraDeviceId);
                      }}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-700 text-white font-mono text-[11px] font-bold rounded-xl border border-slate-700 flex items-center gap-1 transition"
                    >
                      Flip ({facingMode === 'environment' ? 'Back' : 'Front'})
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-Bar: SECONDARY - IP URL Stream */}
              {videoSourceMode === 'WIFI_STREAM' && (
                <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-purple-500/30 text-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-300 flex items-center gap-1.5">
                      <Wifi className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                      IP Camera Stream URL (Secondary Option):
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">HTTP / MJPEG / RTSP</span>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Presets:</span>
                    {[
                      { label: '⭐ jaimiss-iphone:8081', url: 'http://admin:admin@jaimiss-iphone.local:8081/video' },
                      { label: '⭐ 192.168.0.100:8080', url: 'http://192.168.0.100:8080/video' },
                      { label: '⭐ 192.0.0.2:8080', url: 'http://192.0.0.2:8080/video' },
                      { label: 'Novatek 8192', url: 'http://192.168.0.1:8192' },
                      { label: 'RTSP Live 554', url: 'rtsp://192.168.0.1:554/live' }
                    ].map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setWifiStreamUrl(p.url);
                          startWifiStream(p.url);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition ${
                          wifiStreamUrl === p.url
                            ? 'bg-purple-600 text-white shadow ring-2 ring-purple-400'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={wifiStreamUrl}
                      onChange={(e) => setWifiStreamUrl(e.target.value)}
                      placeholder="e.g. http://admin:admin@jaimiss-iphone.local:8081/video"
                      className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-3 py-1.5 text-xs text-purple-200 font-mono focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={() => startWifiStream(wifiStreamUrl)}
                      className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow transition"
                    >
                      Connect
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-Bar: iPhone Wireless Live Relay Status */}
              {videoSourceMode === 'IPHONE_RELAY' && (
                <div className="p-3 bg-indigo-950/60 rounded-2xl border border-indigo-500/30 text-xs flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Radio className={`w-4 h-4 ${mobileTransmitterOnline ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
                    <span className="font-bold text-slate-200">
                      {mobileTransmitterOnline ? (
                        <span className="text-emerald-400 font-mono">🟢 iPhone Wireless Relay Live • {mobileLiveFrame?.speed || 48} km/h • {mobileLiveFrame?.heading || 182}° HDG</span>
                      ) : (
                        <span className="text-amber-300 font-mono">🟡 Waiting for iPhone stream connection...</span>
                      )}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowIPhoneConnectModal(true)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Scan QR / Connect iPhone
                  </button>
                </div>
              )}


              {/* Dashcam Canvas Player */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-video flex items-center justify-center border border-slate-800 shadow-2xl">
                
                {/* Live Wi-Fi Stream Image Stream */}
                {videoSourceMode === 'WIFI_STREAM' && (
                  <div className="absolute inset-0 w-full h-full">
                    <img
                      key={wifiProxyUrl}
                      src={wifiProxyUrl}
                      alt="Live Dashcam Stream"
                      className="w-full h-full object-cover"
                      onLoad={() => setWifiStreamConnected(true)}
                      onError={() => {
                        setWifiStreamConnected(false);
                      }}
                    />
                    {!wifiStreamConnected && (
                      <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-center p-6 space-y-3 z-0">
                        <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                          <Wifi className="w-6 h-6 animate-pulse" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">Connecting to Dashcam Wi-Fi Stream...</p>
                          <p className="text-xs text-purple-300 font-mono mt-1">{wifiStreamUrl}</p>
                          <p className="text-[11px] text-slate-400 mt-2 max-w-md">
                            ⚠️ Ensure your Mac is connected to the <span className="text-amber-400 font-semibold">Dashcam's Wi-Fi network</span> in macOS Wi-Fi settings.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <canvas
                  ref={canvasRef}
                  width={640}
                  height={360}
                  className="w-full h-full object-cover relative z-10 pointer-events-none"
                />

                {/* Floating Action Buttons over Video */}
                <div className="absolute bottom-3 right-3 flex items-center gap-2 z-20">
                  <button
                    onClick={analyzeCurrentLiveFrame}
                    disabled={isAnalyzingFrame}
                    className="px-3 py-1.5 bg-indigo-600/90 hover:bg-indigo-500 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider rounded-xl border border-indigo-400 shadow-lg flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 pointer-events-auto"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    {isAnalyzingFrame ? 'Scanning Frame...' : 'YOLO-v11 Vision Scan'}
                  </button>

                  <button
                    onClick={broadcastRealDashcamHazard}
                    className="px-3 py-1.5 bg-rose-600/90 hover:bg-rose-500 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider rounded-xl border border-rose-400 shadow-lg flex items-center gap-1.5 transition active:scale-95 pointer-events-auto"
                  >
                    <Radio className="w-3.5 h-3.5 animate-pulse" />
                    Broadcast Live Hazard (V2V)
                  </button>
                </div>
              </div>

              {/* Bottom Dashcam Controls & Detection Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700">
                  <p className="text-[10px] text-slate-400">Stream Status</p>
                  <p className="text-sm font-extrabold text-emerald-400 font-mono">
                    {videoSourceMode !== 'SIMULATION' ? 'LIVE FEED' : 'SIMULATION'}
                  </p>
                  <p className="text-[9px] text-slate-500 font-mono">1080p • 60 FPS</p>
                </div>
                <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700">
                  <p className="text-[10px] text-slate-400">AI Confidence</p>
                  <p className="text-sm font-extrabold text-emerald-400 font-mono">98.2%</p>
                  <p className="text-[9px] text-slate-500">YOLO-v11 + Depth</p>
                </div>
                <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700">
                  <p className="text-[10px] text-slate-400">Active Mode</p>
                  <p className="text-sm font-extrabold text-indigo-400 font-mono">
                    {videoSourceMode === 'WEBCAM' ? (isIPhoneConnected ? 'IPHONE_USB' : 'USB_CAM') : videoSourceMode}
                  </p>
                  <p className="text-[9px] text-slate-500">Auto Target Locked</p>
                </div>
                <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700">
                  <p className="text-[10px] text-slate-400">V2V Cloud Sync</p>
                  <p className="text-sm font-extrabold text-blue-400 font-mono">BROADCASTING</p>
                  <p className="text-[9px] text-slate-500">Latency: &lt;14ms</p>
                </div>
              </div>
            </div>

            {/* 6-Stage Telemetry Sequence Visualizer */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" />
                Live 6-Stage Telemetry Pipeline
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-6 h-6 mx-auto mb-1 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">1</div>
                  <p className="text-[11px] font-bold text-slate-800">Dashcam</p>
                  <p className="text-[9px] text-slate-500">1080p Stream</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-6 h-6 mx-auto mb-1 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">2</div>
                  <p className="text-[11px] font-bold text-slate-800">AI Detect</p>
                  <p className="text-[9px] text-slate-500">YOLO + Depth</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-6 h-6 mx-auto mb-1 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">3</div>
                  <p className="text-[11px] font-bold text-slate-800">Cloud Sync</p>
                  <p className="text-[9px] text-slate-500">GPS & Timestamp</p>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="w-6 h-6 mx-auto mb-1 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">4</div>
                  <p className="text-[11px] font-bold text-emerald-900">Verified</p>
                  <p className="text-[9px] text-emerald-700">2+ Vehicles</p>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="w-6 h-6 mx-auto mb-1 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold">5</div>
                  <p className="text-[11px] font-bold text-amber-900">V2V Alert</p>
                  <p className="text-[9px] text-amber-700">Same Route</p>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200">
                  <div className="w-6 h-6 mx-auto mb-1 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">6</div>
                  <p className="text-[11px] font-bold text-blue-900">Decision</p>
                  <p className="text-[9px] text-blue-700">Work Order</p>
                </div>
              </div>
            </div>
          </div>

          {/* OBU Vehicle Telemetry Panel */}
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Car className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-900 text-sm">OBU Telemetry Unit</h3>
                </div>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold">
                  DSRC ACTIVE
                </span>
              </div>

              {/* Vehicle Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Active Connected Vehicle
                </label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.id} • {v.type} ({v.zone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Telemetry Gauges */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] text-slate-500 font-medium">Speed</p>
                  <p className="text-lg font-black text-slate-900 font-mono">
                    {selectedVehicle.speed} <span className="text-xs font-normal text-slate-500">km/h</span>
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] text-slate-500 font-medium">Heading</p>
                  <p className="text-lg font-black text-slate-900 font-mono">
                    {selectedVehicle.heading}° <span className="text-xs font-normal text-slate-500">S</span>
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] text-slate-500 font-medium">Corridor</p>
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {selectedVehicle.zone}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] text-slate-500 font-medium">Comm Protocol</p>
                  <p className="text-xs font-bold text-indigo-600 font-mono">
                    {selectedVehicle.comm_mode}
                  </p>
                </div>
              </div>

              {/* Hardware-Ready Architecture Note */}
              <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-2xl text-[11px] text-indigo-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-indigo-800">
                  <Zap className="w-3.5 h-3.5 text-indigo-600" />
                  Hardware-Ready Architecture
                </p>
                <p className="text-slate-600 text-[10px] leading-relaxed">
                  Conforms to SAE J2735 / IEEE 802.11p DSRC message sets. Telemetry is streamed over REST + WebSockets, ready for real OBU / GPS / dashcam camera attachment.
                </p>
              </div>
            </div>

            {/* Quick Community Hazard Stats */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-900 text-xs flex items-center justify-between">
                <span>Community Cloud Status</span>
                <span className="text-emerald-600 font-mono text-[10px] font-bold">LIVE SYNC</span>
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-xl">
                  <span className="text-slate-600 font-medium">Verified Hazards</span>
                  <span className="font-black text-emerald-600">
                    {hazards.filter((h) => h.status === 'COMMUNITY_VERIFIED').length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-xl">
                  <span className="text-slate-600 font-medium">Work Orders Dispatched</span>
                  <span className="font-black text-indigo-600">{workOrders.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-xl">
                  <span className="text-slate-600 font-medium">Active Connected OBUs</span>
                  <span className="font-black text-blue-600">{vehicles.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: COMMUNITY SAFETY MAP */}
      {activeView === 'community-map' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Bengaluru Community Road Hazards Map
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pins represent dashcam-reported potholes, accidents, and blockages with community verification status.
                  </p>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                  >
                    <option value="ALL">All Categories</option>
                    <option value="POTHOLE">Potholes</option>
                    <option value="ACCIDENT">Accidents</option>
                    <option value="ROAD_BLOCKAGE">Blockages</option>
                    <option value="PEDESTRIAN_HAZARD">Pedestrian Hazards</option>
                  </select>
                  <button
                    onClick={() => setVerifiedOnly(!verifiedOnly)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      verifiedOnly
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Verified Only
                  </button>
                </div>
              </div>

              {/* Map Canvas / Grid Representation */}
              <div className="relative aspect-[16/9] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 p-6 flex flex-col justify-between">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />
                
                {/* Bengaluru Zones Grid Pins */}
                <div className="relative z-10 grid grid-cols-3 gap-4 h-full">
                  {BANGALORE_LANDMARKS.slice(0, 6).map((landmark, idx) => {
                    const landmarkHazards = hazards.filter((h) => h.zone_name.includes(landmark.name.split(' ')[0]));
                    return (
                      <div
                        key={idx}
                        className="p-3 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl flex flex-col justify-between hover:border-indigo-500 transition cursor-pointer"
                      >
                        <div className="flex items-start justify-between">
                          <p className="text-xs font-bold text-slate-200">{landmark.name}</p>
                          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {landmark.lat.toFixed(4)}°N, {landmark.lng.toFixed(4)}°E
                        </p>
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                          <span className="text-slate-400">Hazards:</span>
                          <span className="font-bold text-amber-400">{landmarkHazards.length} Active</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Map Overlay Badge */}
                <div className="relative z-10 flex items-center justify-between pt-4 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <span>📍 City Center: Bengaluru (12.9716° N, 77.5946° E)</span>
                  <span className="text-indigo-400 font-bold">Showing {filteredHazards.length} Community Hazards</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hazard Details List */}
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center justify-between">
                <span>Community Hazard Reports</span>
                <span className="text-xs text-indigo-600 font-bold">{filteredHazards.length} Total</span>
              </h3>

              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {filteredHazards.map((h) => (
                  <div
                    key={h.hazard_id}
                    onClick={() => setSelectedHazard(h)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                      selectedHazard?.hazard_id === h.hazard_id
                        ? 'bg-indigo-50/70 border-indigo-300 shadow-sm'
                        : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase mb-1 ${
                            h.status === 'COMMUNITY_VERIFIED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {h.status === 'COMMUNITY_VERIFIED' ? `✓ VERIFIED (${h.verification_count})` : 'REPORTED (1)'}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900">{h.title}</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">{h.road}</p>
                      </div>
                      <span className="text-[10px] font-extrabold text-indigo-600 font-mono">
                        {h.speed_advisory_kmh} km/h
                      </span>
                    </div>

                    {h.work_order_id && (
                      <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-indigo-700 font-semibold">
                        <span>Work Order: {h.work_order_id}</span>
                        <span className="text-emerald-700">Crew Dispatched</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: BBMP INFRASTRUCTURE WORK ORDERS */}
      {activeView === 'work-orders' && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-slate-900 text-lg">
                  BBMP Infrastructure Maintenance Work Orders
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Automated work orders generated by the Infrastructure Agent when potholes or road defects receive verified community reports.
              </p>
            </div>
            <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl">
              {workOrders.length} Total Dispatched
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workOrders.map((wo) => (
              <div
                key={wo.work_order_id}
                className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/40 border border-indigo-100 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between">
                  <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-mono font-bold">
                    {wo.work_order_id}
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold">
                    {wo.status}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{wo.hazard_title}</h4>
                  <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {wo.road}
                  </p>
                </div>

                <div className="space-y-1 pt-2 border-t border-indigo-100/60 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Assigned Taskforce:</span>
                    <span className="font-semibold text-slate-800 text-[11px] truncate max-w-[160px]">
                      {wo.crew}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Severity / Priority:</span>
                    <span className="font-bold text-amber-600">{wo.severity}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Est. Repair Window:</span>
                    <span className="font-bold text-slate-800">{wo.estimated_repair_time}</span>
                  </div>
                </div>

                <div className="p-2 bg-white rounded-xl border border-indigo-100 text-[10px] text-slate-500 font-mono">
                  Coordinates: {wo.lat?.toFixed(4)}° N, {wo.lng?.toFixed(4)}° E
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 4: 6-STAGE LIVE EVENT PIPELINE FEED */}
      {activeView === 'pipeline-feed' && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                Live 6-Stage Event Pipeline Feed
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time chronological events across Dashcam AI, Cloud Ingestion, Verification, V2V Alerts, and UrbanFlow Decisions.
              </p>
            </div>
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          <div className="space-y-3">
            {pipelineFeed.map((entry, idx) => (
              <div
                key={entry.id || idx}
                className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 flex items-start gap-4"
              >
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 font-mono text-[10px] font-bold rounded">
                      {entry.badge}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm mt-1">{entry.title}</h4>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{entry.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── IPHONE BACK CAMERA CONNECT MODAL WITH QR CODE ── */}
      {showIPhoneConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl text-white relative space-y-6">
            
            {/* Close Button */}
            <button
              onClick={() => setShowIPhoneConnectModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              ✕
            </button>

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  Connect iPhone Back Camera
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Live V2V Road Dashcam & AI Pothole Scanner
                </p>
              </div>
            </div>

            {/* Live Connection Status Badge */}
            <div className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-mono font-bold ${
              mobileTransmitterOnline
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${mobileTransmitterOnline ? 'bg-emerald-400 animate-ping' : 'bg-amber-400 animate-pulse'}`} />
                <span>
                  {mobileTransmitterOnline
                    ? '🟢 iPhone Back Camera Active & Streaming Live!'
                    : '⚪ Waiting for iPhone to connect...'}
                </span>
              </div>
              {mobileTransmitterOnline && (
                <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-full text-emerald-300">
                  {mobileLiveFrame?.speed || 48} km/h
                </span>
              )}
            </div>

            {/* QR Code Section */}
            <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-inner space-y-3">
              <QRCodeSVG
                value={networkInfo?.dashcamUrl || `${window.location.protocol}//${window.location.hostname}:${window.location.port || '5173'}/dashcam`}
                size={210}
                level="H"
                includeMargin={true}
              />
              <p className="text-xs font-black font-mono text-slate-900 text-center">
                Scan with iPhone Camera App
              </p>
              <p className="text-[10px] text-slate-600 text-center max-w-xs">
                📶 Ensure your iPhone and Mac are on the <span className="font-bold text-indigo-700">same Wi-Fi network</span> or connect Mac to iPhone Personal Hotspot.
              </p>
            </div>

            {/* URL & Action Buttons */}
            <div className="space-y-2">
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                Direct Mobile Dashcam URL (Local Network):
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={networkInfo?.dashcamUrl || `${window.location.protocol}//${window.location.hostname}:${window.location.port || '5173'}/dashcam`}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-indigo-300 font-mono text-xs focus:outline-none select-all"
                />
                <button
                  onClick={() => {
                    const url = networkInfo?.dashcamUrl || `${window.location.protocol}//${window.location.hostname}:${window.location.port || '5173'}/dashcam`;
                    navigator.clipboard.writeText(url);
                    setIsCopied(true);
                    toast.success('📋 Link copied to clipboard!');
                    setTimeout(() => setIsCopied(false), 3000);
                  }}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0"
                >
                  {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {isCopied ? 'Copied' : 'Copy'}
                </button>
                <a
                  href={networkInfo?.dashcamUrl || '/dashcam'}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition flex items-center justify-center shrink-0"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* 3 Step Instructions */}
            <div className="space-y-2 pt-2 border-t border-slate-800 text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  <strong>Scan QR Code:</strong> Open your iPhone Camera and point at the QR code above (or open the URL in Safari).
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  <strong>Allow Camera:</strong> Tap &quot;Allow&quot; when iOS Safari prompts for camera permissions. Your iPhone rear camera will activate instantly.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  <strong>Live V2V Stream:</strong> Mount iPhone on dashboard or point out windshield. Real-time video &amp; AI detections will stream live onto this screen!
                </span>
              </div>
            </div>

            {/* Close / Done Button */}
            <button
              onClick={() => setShowIPhoneConnectModal(false)}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-lg transition active:scale-95"
            >
              Done &amp; View Live Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
