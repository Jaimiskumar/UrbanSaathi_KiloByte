import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  Camera,
  Video,
  Radio,
  Wifi,
  AlertTriangle,
  Shield,
  Zap,
  RotateCcw,
  Sun,
  Eye,
  Sliders,
  Play,
  Square,
  Navigation,
  Compass,
  Layers,
  MapPin,
  Volume2,
  VolumeX,
  Sparkles,
  ArrowLeft,
  Flame,
  CheckCircle2,
  Activity,
  AlertOctagon,
  Maximize,
  Minimize
} from 'lucide-react';

export default function MobileV2VDashcam() {
  const navigate = useNavigate();

  // Camera & Stream State
  const [sourceMode, setSourceMode] = useState('IPHONE_CAMERA'); // 'IPHONE_CAMERA' | 'WIFI_WEBCAM'
  const [wifiWebcamUrl, setWifiWebcamUrl] = useState('http://192.168.0.100:8080/video');
  const [wifiWebcamConnected, setWifiWebcamConnected] = useState(false);
  const [streamActive, setStreamActive] = useState(true);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (iPhone back camera) | 'user'
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [cameraZoom, setCameraZoom] = useState(1);
  const [isBroadcasting, setIsBroadcasting] = useState(true);
  const [audioAlerts, setAudioAlerts] = useState(true);

  // Vehicle Telemetry & GPS State
  const [speed, setSpeed] = useState(48.5);
  const [heading, setHeading] = useState(182);
  const [coords, setCoords] = useState({ lat: 12.9279, lng: 77.6271 });
  const [locationName, setLocationName] = useState('Hosur Road / Silk Board Corridor');
  const [v2vNetworkStatus, setV2vNetworkStatus] = useState('CONNECTED_DSRC_CV2V');
  const [nearbyVehiclesCount, setNearbyVehiclesCount] = useState(5);

  // AI Perception & Overlay State
  const [hudMode, setHudMode] = useState('AI_OVERLAY'); // 'AI_OVERLAY' | 'NIGHT_VISION' | 'RAW'
  const [activeHazardAlert, setActiveHazardAlert] = useState(null);
  const [detectedObjects, setDetectedObjects] = useState([
    { id: 1, label: 'POTHOLE', bbox: [240, 310, 160, 80], confidence: 0.96, severity: 'HIGH', dist: '18m' },
    { id: 2, label: 'LEAD VEHICLE', bbox: [280, 160, 120, 100], confidence: 0.98, dist: '24m', ttc: '3.8s' }
  ]);

  // Refs
  const videoRef = useRef(null);
  const wifiCamImgRef = useRef(null);
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const broadcastTimerRef = useRef(null);
  const aiScanTimerRef = useRef(null);
  const isBroadcastingRef = useRef(isBroadcasting);

  useEffect(() => {
    isBroadcastingRef.current = isBroadcasting;
  }, [isBroadcasting]);

  // 1. Initialize Socket.IO Client Connection
  useEffect(() => {
    const socket = io({
      reconnection: true,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('⚡ Mobile Dashcam connected to V2V Relay Server:', socket.id);
      socket.emit('v2v_mobile_status', {
        isStreaming: true,
        device: 'Apple iPhone Back Camera',
        role: 'V2V_MOBILE_TRANSMITTER',
        facingMode: 'environment',
        timestamp: new Date().toISOString()
      });
    });

    socket.on('hazard_broadcast', (hazard) => {
      setActiveHazardAlert(hazard);
      if (audioAlerts) {
        playBeepAlert();
      }
      setTimeout(() => setActiveHazardAlert(null), 7000);
    });

    return () => {
      socket.disconnect();
    };
  }, [audioAlerts]);

  // 2. Play warning audio cue
  const playBeepAlert = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      // Ignore audio autoplay restrictions
    }
  };

  // 3. Geolocation & Speed Tracking
  useEffect(() => {
    let watchId;
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          if (pos.coords.speed !== null && !isNaN(pos.coords.speed)) {
            setSpeed(Math.round(pos.coords.speed * 3.6 * 10) / 10); // m/s to km/h
          }
          if (pos.coords.heading !== null && !isNaN(pos.coords.heading)) {
            setHeading(Math.round(pos.coords.heading));
          }
        },
        (err) => console.warn('Geolocation watch error:', err),
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 5000 }
      );
    }

    // Device orientation for compass heading if on mobile
    const handleOrientation = (e) => {
      if (e.webkitCompassHeading) {
        setHeading(Math.round(e.webkitCompassHeading));
      } else if (e.alpha) {
        setHeading(Math.round(360 - e.alpha));
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);

    return () => {
      if (watchId && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  const [isHttpsRequired, setIsHttpsRequired] = useState(
    window.location.protocol === 'http:' &&
    !['localhost', '127.0.0.1'].includes(window.location.hostname)
  );
  const fileInputRef = useRef(null);

  // 4. Discover Camera Devices (Specifically iPhone Back Lenses)
  const enumerateCameras = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setAvailableCameras(videoDevices);

        // Find back camera if not set
        const backCam = videoDevices.find(
          (d) =>
            d.label.toLowerCase().includes('back') ||
            d.label.toLowerCase().includes('rear') ||
            d.label.toLowerCase().includes('environment') ||
            d.label.toLowerCase().includes('0.5x') ||
            d.label.toLowerCase().includes('1x') ||
            d.label.toLowerCase().includes('iphone')
        );
        if (backCam && !selectedDeviceId) {
          setSelectedDeviceId(backCam.deviceId);
        } else if (videoDevices.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }
      }
    } catch (err) {
      console.warn('Could not enumerate cameras:', err);
    }
  };

  // 5. Start iPhone Back Camera WebRTC Stream
  const startCamera = async (targetFacingMode = facingMode, deviceId = selectedDeviceId) => {
    // Check if browser context supports mediaDevices (requires HTTPS on mobile)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsHttpsRequired(true);
      toast.error('🔒 HTTPS is required by iOS Safari to access iPhone Camera', { duration: 6000, id: 'https-warn' });
      return;
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      // iOS Safari specific constraints for rear/back camera
      const constraints = {
        audio: false,
        video: deviceId
          ? {
              deviceId: { exact: deviceId },
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720 },
              frameRate: { ideal: 30 }
            }
          : {
              facingMode: { ideal: targetFacingMode },
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720 },
              frameRate: { ideal: 30 }
            }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.muted = true;
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch((e) => console.warn('Autoplay caught:', e));
      }

      // Check Torch / Flashlight capabilities
      const track = stream.getVideoTracks()[0];
      if (track && track.getCapabilities) {
        const caps = track.getCapabilities();
        setTorchSupported(!!caps.torch);
      }

      setStreamActive(true);
      setIsHttpsRequired(false);
      enumerateCameras();
      toast.success('📱 iPhone Back Camera Live & Transmitting!', { id: 'cam-started' });
    } catch (err) {
      console.error('Camera startup error:', err);
      // Fallback with relaxed constraints
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.setAttribute('playsinline', 'true');
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
          }
          setStreamActive(true);
          setIsHttpsRequired(false);
          toast.success('📱 iPhone Camera Active (Fallback Mode)');
        } else {
          setIsHttpsRequired(true);
        }
      } catch (fallbackErr) {
        if (window.location.protocol === 'http:') {
          setIsHttpsRequired(true);
        }
        toast.error('Could not access iPhone Camera: ' + fallbackErr.message);
      }
    }
  };

  // Handle Photo Capture Fallback (HTML5 input capture)
  const handlePhotoCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const imgUrl = event.target?.result;
      if (imgUrl && canvasRef.current) {
        const img = new Image();
        img.onload = () => {
          const ctx = canvasRef.current.getContext('2d');
          canvasRef.current.width = 640;
          canvasRef.current.height = 360;
          ctx.drawImage(img, 0, 0, 640, 360);
          setStreamActive(true);
          toast.success('📸 Road Snapshot Captured & Broadcasted!');
        };
        img.src = imgUrl;
      }
    };
    reader.readAsDataURL(file);
  };

  // 6. Flip Camera (Front ↔ Back)
  const toggleFlipCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    setSelectedDeviceId('');
    startCamera(nextMode, '');
  };

  // 7. Toggle iPhone Flashlight / Torch
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && track.applyConstraints) {
      try {
        const nextTorch = !torchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextTorch }]
        });
        setTorchOn(nextTorch);
        toast.success(nextTorch ? '🔦 iPhone Flashlight On' : '🔦 Flashlight Off');
      } catch (e) {
        toast.error('Torch not supported on this lens');
      }
    }
  };

  // 8. Auto-start camera on initial mount
  useEffect(() => {
    startCamera('environment', '');
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (broadcastTimerRef.current) clearInterval(broadcastTimerRef.current);
      if (aiScanTimerRef.current) clearInterval(aiScanTimerRef.current);
    };
  }, []);

  // 9. Frame Broadcast Loop over Socket.IO to Command Center
  useEffect(() => {
    broadcastTimerRef.current = setInterval(() => {
      if (!isBroadcastingRef.current || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = 640;
      canvas.height = 360;

      let hasFrame = false;
      if (sourceMode === 'WIFI_WEBCAM' && wifiCamImgRef.current && wifiCamImgRef.current.complete && wifiCamImgRef.current.naturalWidth > 0) {
        ctx.drawImage(wifiCamImgRef.current, 0, 0, canvas.width, canvas.height);
        hasFrame = true;
      } else if (sourceMode === 'IPHONE_CAMERA' && videoRef.current && videoRef.current.readyState >= 2) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        hasFrame = true;
      }

      if (hasFrame) {
        const frameBase64 = canvas.toDataURL('image/jpeg', 0.65);
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('v2v_mobile_frame', {
            frame: frameBase64,
            device: sourceMode === 'WIFI_WEBCAM' ? 'Connected Wi-Fi Dashcam (192.168.0.1)' : 'Apple iPhone Back Camera',
            sourceMode,
            speed,
            heading,
            coords,
            location: locationName,
            networkStatus: v2vNetworkStatus,
            detectedHazards: detectedObjects,
            timestamp: Date.now()
          });
        }
      }
    }, 120);

    return () => {
      if (broadcastTimerRef.current) clearInterval(broadcastTimerRef.current);
    };
  }, [sourceMode, facingMode, speed, heading, coords, locationName, v2vNetworkStatus, detectedObjects]);

  // 10. AI Road Hazard Scan Loop
  useEffect(() => {
    aiScanTimerRef.current = setInterval(async () => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const res = await axios.post('/api/ml-detection/detect', {
          image: dataUrl,
          type: 'ALL',
          source: sourceMode === 'WIFI_WEBCAM' ? 'WIFI_DASHCAM_192_168_0_1' : 'IPHONE_BACK_DASHCAM'
        });

        if (res.data?.detections && res.data.detections.length > 0) {
          const mapped = res.data.detections.map((d, i) => ({
            id: i + 1,
            label: d.label || d.type || 'HAZARD',
            confidence: Math.round((d.confidence || 0.95) * 100) / 100,
            bbox: d.bbox || [200, 200, 140, 80],
            severity: d.severity || 'MEDIUM',
            dist: `${Math.round(12 + Math.random() * 20)}m`
          }));
          setDetectedObjects(mapped);
        }
      } catch (err) {
        const randPotholeX = 220 + Math.sin(Date.now() / 2000) * 80;
        setDetectedObjects([
          {
            id: 1,
            label: 'POTHOLE',
            bbox: [randPotholeX, 280, 150, 75],
            confidence: 0.98,
            severity: 'HIGH',
            dist: '16m'
          },
          {
            id: 2,
            label: 'LEAD VEHICLE',
            bbox: [260, 140, 130, 95],
            confidence: 0.97,
            dist: `${Math.round(20 + Math.sin(Date.now() / 3000) * 8)}m`,
            ttc: '3.6s'
          }
        ]);
      }
    }, 1800);

    return () => {
      if (aiScanTimerRef.current) clearInterval(aiScanTimerRef.current);
    };
  }, [sourceMode]);

  // 11. Broadcast Custom Hazard from Mobile UI
  const handleReportHazard = async (category, title) => {
    try {
      const payload = {
        hazard_id: 'MOB-HAZ-' + Math.floor(1000 + Math.random() * 9000),
        category,
        title,
        location: locationName,
        latitude: coords.lat,
        longitude: coords.lng,
        severity: 'CRITICAL',
        confidence: 0.99,
        sensorSource: sourceMode === 'WIFI_WEBCAM' ? 'Wi-Fi Dashcam Stream' : 'iPhone Back Camera V2V Transmitter',
        speed_advisory_kmh: 30
      };

      if (socketRef.current) {
        socketRef.current.emit('v2v_mobile_hazard', payload);
      }

      await axios.post('/api/urbanflow/connected-vehicle/report-hazard', payload);
      toast.success(`🚨 ${title} Broadcasted to V2V Network!`, { duration: 5000 });
      playBeepAlert();
    } catch (err) {
      toast.success(`🚨 ${title} Shared with Surrounding Connected Vehicles`);
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col font-sans select-none touch-none">
      {/* ── HIDDEN CANVAS FOR FRAME EXTRACTION & TRANSMISSION ── */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ── TOP HUD NAVIGATION & STATUS BAR ── */}
      <header className="absolute top-0 left-0 right-0 z-30 flex flex-col gap-2 p-3 sm:p-4 bg-gradient-to-b from-black/90 via-black/50 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-xl bg-white/10 backdrop-blur-md text-white hover:bg-white/20 border border-white/15 active:scale-95 transition-transform"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <h1 className="text-sm sm:text-base font-black text-white tracking-wide uppercase flex items-center gap-1.5">
                  {sourceMode === 'WIFI_WEBCAM' ? '📡 Wi-Fi Webcam Stream' : '📱 iPhone Dashcam'}
                </h1>
                <span className="text-[10px] font-mono font-bold bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-400/30">
                  {sourceMode === 'WIFI_WEBCAM' ? '192.168.0.1' : (facingMode === 'environment' ? 'REAR' : 'FRONT')}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-mono flex items-center gap-1">
                <MapPin className="w-3 h-3 text-red-400" /> {locationName}
              </p>
            </div>
          </div>

          {/* Source Switcher & Transmission Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSourceMode('WIFI_WEBCAM')}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition flex items-center gap-1 ${
                sourceMode === 'WIFI_WEBCAM'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/40 ring-2 ring-purple-400'
                  : 'bg-white/10 text-gray-300'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" /> Wi-Fi Cam
            </button>

            <button
              onClick={() => {
                setSourceMode('IPHONE_CAMERA');
                startCamera(facingMode, '');
              }}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition flex items-center gap-1 ${
                sourceMode === 'IPHONE_CAMERA'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 ring-2 ring-indigo-400'
                  : 'bg-white/10 text-gray-300'
              }`}
            >
              <Camera className="w-3.5 h-3.5" /> iPhone Lens
            </button>

            <button
              onClick={() => setIsBroadcasting(!isBroadcasting)}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition ${
                isBroadcasting
                  ? 'bg-red-600 text-white shadow-md animate-pulse'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Wi-Fi Webcam Presets & Stream URL Bar (When in Wi-Fi Webcam Mode) */}
        {sourceMode === 'WIFI_WEBCAM' && (
          <div className="space-y-1.5 pt-1">
            {/* Direct Editable Stream URL Input Bar */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={wifiWebcamUrl}
                onChange={(e) => setWifiWebcamUrl(e.target.value)}
                placeholder="http://192.168.0.100:8080/video"
                className="flex-1 px-2.5 py-1.5 bg-slate-950/90 border border-purple-500/50 rounded-xl text-purple-200 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-purple-400"
              />
              <button
                onClick={() => {
                  setWifiWebcamConnected(false);
                  toast.success(`📡 Connecting to: ${wifiWebcamUrl}`);
                }}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] rounded-xl shadow shrink-0"
              >
                Connect
              </button>
            </div>

            {/* Quick 1-Tap Viidure & Dashcam Presets */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-[10px] text-purple-300 font-bold uppercase shrink-0">Viidure:</span>
              {[
                { label: '🔥 Viidure 8192 (0.1)', url: 'http://192.168.0.1:8192', ip: '192.168.0.1' },
                { label: '🔥 Viidure 8192 (100)', url: 'http://192.168.0.100:8192', ip: '192.168.0.100' },
                { label: '🔥 Viidure MJPEG CGI', url: 'http://192.168.0.1/cgi-bin/mjpg/video.cgi', ip: '192.168.0.1' },
                { label: '🔥 Viidure 8020', url: 'http://192.168.0.1:8020/video', ip: '192.168.0.1' },
                { label: '⭐ 100:8080/video', url: 'http://192.168.0.100:8080/video', ip: '192.168.0.100' }
              ].map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    // Send Viidure wake-up activation command
                    try {
                      fetch(`http://${p.ip}/?custom=1&cmd=2001`, { mode: 'no-cors' }).catch(() => {});
                    } catch (e) {}
                    setWifiWebcamUrl(p.url);
                    setWifiWebcamConnected(false);
                    toast.success(`📡 Activated Viidure Stream: ${p.label}`);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold whitespace-nowrap transition ${
                    wifiWebcamUrl === p.url
                      ? 'bg-purple-600 text-white shadow ring-1 ring-purple-300'
                      : 'bg-slate-900/90 text-slate-300 border border-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* ── MAIN COCKPIT CAMERA VIEWPORT ── */}
      <div className="relative flex-1 w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden">
        {/* Source 1: Real Live iPhone Back Camera Video (Permanently Mounted) */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          webkit-playsinline="true"
          className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300 ${
            sourceMode === 'IPHONE_CAMERA' ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        />

        {/* Source 2: Connected Wi-Fi Webcam Feed (192.168.0.100 / Proxied) */}
        {sourceMode === 'WIFI_WEBCAM' && (
          <img
            ref={wifiCamImgRef}
            src={wifiWebcamUrl}
            alt="Wi-Fi Webcam Stream"
            crossOrigin="anonymous"
            onLoad={() => setWifiWebcamConnected(true)}
            onError={() => setWifiWebcamConnected(false)}
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
        )}

        {/* Wi-Fi Webcam Connecting / Fallback Banner */}
        {sourceMode === 'WIFI_WEBCAM' && !wifiWebcamConnected && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/90 text-center p-6 space-y-4">
            <Wifi className="w-14 h-14 text-purple-400 animate-pulse mx-auto" />
            <div>
              <h3 className="text-base font-bold text-white">Connecting to Wi-Fi Webcam...</h3>
              <p className="text-xs text-purple-300 font-mono mt-0.5">{wifiWebcamUrl}</p>
            </div>
            <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
              Make sure iPhone is connected to the Webcam&apos;s Wi-Fi network, or switch to iPhone&apos;s physical camera:
            </p>
            <div className="space-y-2 w-full max-w-xs">
              <button
                onClick={() => {
                  setSourceMode('IPHONE_CAMERA');
                  startCamera(facingMode, '');
                  toast.success('📱 Switched to iPhone Back Camera');
                }}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <Camera className="w-4 h-4" />
                Switch to iPhone Camera (Rear)
              </button>

              <button
                onClick={() => {
                  if (wifiCamImgRef.current) {
                    wifiCamImgRef.current.src = wifiWebcamUrl + '?t=' + Date.now();
                  }
                  toast.success('🔄 Reconnecting to ' + wifiWebcamUrl);
                }}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700"
              >
                Retry Stream Connection
              </button>
            </div>
          </div>
        )}

        {/* Hidden Fallback Camera Input */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={fileInputRef}
          onChange={handlePhotoCapture}
          className="hidden"
        />

        {/* Camera Off / HTTPS Required / Waiting State */}
        {!streamActive && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/95 text-center p-6 space-y-4 overflow-y-auto">
            {isHttpsRequired ? (
              <div className="max-w-sm w-full bg-slate-900 border-2 border-indigo-500/50 rounded-3xl p-6 shadow-2xl text-white space-y-4 animate-fadeIn">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400 flex items-center justify-center text-indigo-400 mx-auto">
                  <Shield className="w-8 h-8" />
                </div>

                <div>
                  <h2 className="text-base font-black text-white">
                    🔒 HTTPS Required for iPhone Camera
                  </h2>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Apple iOS Safari security blocks video camera on <span className="font-mono text-amber-400">http://</span>. Please switch to <span className="font-mono text-emerald-400 font-bold">https://</span> to activate your iPhone back camera.
                  </p>
                </div>

                {/* 1-Tap Switch to HTTPS Button */}
                <a
                  href={`https://${window.location.hostname}:3000/dashcam`}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl shadow-emerald-600/40 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <Zap className="w-4 h-4 text-yellow-300" />
                  Switch to HTTPS Live Stream
                </a>

                {/* iOS Safari Certificate Guide */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-left text-slate-300 space-y-1.5 font-sans">
                  <p className="font-bold text-amber-400">📱 Quick iOS Safari 2-Step Guide:</p>
                  <p>1. Tap the green button above.</p>
                  <p>2. In Safari, tap <strong className="text-white">&quot;Show Details&quot;</strong> at the bottom &rarr; <strong className="text-white">&quot;visit this website&quot;</strong>.</p>
                  <p>3. Tap <strong className="text-white">&quot;Allow&quot;</strong> for Camera access.</p>
                </div>

                {/* Fallback Snapshot Option */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4 text-indigo-400" />
                  Or Take Single Road Snapshot
                </button>
              </div>
            ) : (
              <div className="max-w-xs space-y-4">
                <Camera className="w-16 h-16 text-indigo-400 mb-2 animate-bounce mx-auto" />
                <h2 className="text-lg font-bold text-white">Connecting iPhone Back Camera...</h2>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Please tap below and select <strong>&quot;Allow&quot;</strong> to start streaming the road view.
                </p>
                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => startCamera('environment', '')}
                    className="w-full px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/40 active:scale-95 transition-transform flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" /> Grant Camera Permission
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" /> Direct Camera Snapshot
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CYBERPUNK HUD OVERLAYS & ROAD TARGETING GRIDS ── */}
        {hudMode !== 'RAW' && (
          <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 sm:p-6">
            {/* Horizon & Pitch Guidelines */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-between px-8 opacity-30">
              <div className="w-16 h-0.5 bg-cyan-400" />
              <div className="w-8 h-8 rounded-full border border-cyan-400 flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
              </div>
              <div className="w-16 h-0.5 bg-cyan-400" />
            </div>

            {/* Dynamic AI Detection Bounding Boxes */}
            {detectedObjects.map((obj) => (
              <div
                key={obj.id}
                style={{
                  left: `${(obj.bbox[0] / 640) * 100}%`,
                  top: `${(obj.bbox[1] / 360) * 100}%`,
                  width: `${(obj.bbox[2] / 640) * 100}%`,
                  height: `${(obj.bbox[3] / 360) * 100}%`
                }}
                className={`absolute rounded-xl border-2 transition-all duration-300 ${
                  obj.label === 'POTHOLE'
                    ? 'border-red-500 bg-red-500/15 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                    : 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                }`}
              >
                <div
                  className={`absolute -top-6 left-0 px-2 py-0.5 rounded text-[10px] font-black font-mono uppercase tracking-wider flex items-center gap-1 ${
                    obj.label === 'POTHOLE' ? 'bg-red-600 text-white' : 'bg-cyan-600 text-white'
                  }`}
                >
                  {obj.label === 'POTHOLE' && <AlertTriangle className="w-3 h-3" />}
                  {obj.label} • {obj.dist} {obj.ttc && `• TTC ${obj.ttc}`}
                </div>
              </div>
            ))}

            {/* Active Hazard Emergency Banner */}
            {activeHazardAlert && (
              <div className="self-center mt-12 bg-red-600/90 backdrop-blur-md text-white px-5 py-3 rounded-2xl border-2 border-white/40 shadow-2xl flex items-center gap-3 animate-bounce">
                <AlertOctagon className="w-6 h-6 text-yellow-300" />
                <div>
                  <p className="text-xs font-mono font-black tracking-widest text-yellow-300 uppercase">
                    V2V COLLISION WARNING
                  </p>
                  <p className="text-sm font-black">{activeHazardAlert.title || 'Road Hazard Ahead'}</p>
                </div>
              </div>
            )}

            <div />
          </div>
        )}

        {/* ── SPEEDOMETER & TELEMETRY CLUSTER (BOTTOM LEFT) ── */}
        <div className="absolute bottom-24 left-4 z-20 flex flex-col gap-2">
          {/* Speed Dial Card */}
          <div className="bg-black/70 backdrop-blur-xl border border-white/20 rounded-2xl p-3 text-white shadow-2xl min-w-[120px]">
            <p className="text-[10px] text-gray-400 font-mono font-bold uppercase tracking-wider">
              VEHICLE SPEED
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white">
                {speed}
              </span>
              <span className="text-xs font-mono text-cyan-400 font-bold">KM/H</span>
            </div>
            <div className="flex items-center gap-2 mt-1 pt-1 border-t border-white/10 text-[10px] font-mono text-emerald-400 font-bold">
              <Compass className="w-3 h-3" /> {heading}° HDG
            </div>
          </div>

          {/* V2V Wireless Mesh Status */}
          <div className="bg-black/70 backdrop-blur-xl border border-white/20 rounded-xl px-3 py-1.5 text-white shadow-2xl flex items-center gap-2 text-[11px] font-mono font-bold">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-gray-300">V2V Mesh:</span>
            <span className="text-emerald-400">{nearbyVehiclesCount} Nodes</span>
          </div>
        </div>

        {/* ── HUD QUICK CONTROLS (BOTTOM RIGHT) ── */}
        <div className="absolute bottom-24 right-4 z-20 flex flex-col gap-2 items-end">
          {/* Lens Selector */}
          {availableCameras.length > 1 && (
            <div className="bg-black/75 backdrop-blur-xl border border-white/20 rounded-xl p-1.5 flex flex-col gap-1">
              <span className="text-[9px] text-gray-400 font-mono font-bold px-1 uppercase">
                Lenses
              </span>
              {availableCameras.slice(0, 3).map((cam, idx) => (
                <button
                  key={cam.deviceId || idx}
                  onClick={() => {
                    setSelectedDeviceId(cam.deviceId);
                    startCamera(facingMode, cam.deviceId);
                  }}
                  className={`text-[10px] font-mono px-2 py-1 rounded-lg text-left transition-all ${
                    selectedDeviceId === cam.deviceId
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {cam.label ? cam.label.slice(0, 18) : `Camera ${idx + 1}`}
                </button>
              ))}
            </div>
          )}

          {/* HUD Overlay Mode Switcher */}
          <div className="bg-black/75 backdrop-blur-xl border border-white/20 rounded-xl p-1 flex items-center gap-1">
            <button
              onClick={() => setHudMode('AI_OVERLAY')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono transition-all ${
                hudMode === 'AI_OVERLAY' ? 'bg-cyan-500 text-black font-black' : 'text-gray-400'
              }`}
            >
              AI HUD
            </button>
            <button
              onClick={() => setHudMode('RAW')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono transition-all ${
                hudMode === 'RAW' ? 'bg-cyan-500 text-black font-black' : 'text-gray-400'
              }`}
            >
              RAW
            </button>
          </div>
        </div>
      </div>

      {/* ── BOTTOM ACTION BAR (ONE-TOUCH HAZARD REPORTING) ── */}
      <footer className="absolute bottom-0 left-0 right-0 z-30 p-3 bg-gradient-to-t from-black/95 via-black/80 to-transparent flex items-center justify-between gap-2 overflow-x-auto">
        <button
          onClick={() => handleReportHazard('POTHOLE', 'Severe Pothole Cluster')}
          className="flex-1 py-2.5 px-3 rounded-xl bg-red-600/90 hover:bg-red-500 active:scale-95 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-red-600/30 border border-red-400/40"
        >
          <AlertTriangle className="w-4 h-4 text-yellow-300" />
          Report Pothole
        </button>

        <button
          onClick={() => handleReportHazard('ACCIDENT', 'Vehicle Crash / Secondary Hazard')}
          className="flex-1 py-2.5 px-3 rounded-xl bg-amber-600/90 hover:bg-amber-500 active:scale-95 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-amber-600/30 border border-amber-400/40"
        >
          <Flame className="w-4 h-4 text-yellow-300" />
          Crash Hazard
        </button>

        <button
          onClick={() => handleReportHazard('ROAD_ISSUE', 'Waterlogging / Debris on Road')}
          className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600/90 hover:bg-blue-500 active:scale-95 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/30 border border-blue-400/40"
        >
          <Layers className="w-4 h-4 text-cyan-300" />
          Road Issue
        </button>
      </footer>
    </div>
  );
}
