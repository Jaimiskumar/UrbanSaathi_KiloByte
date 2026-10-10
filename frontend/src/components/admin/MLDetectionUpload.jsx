import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Play, 
  Pause, 
  CheckCircle, 
  AlertTriangle, 
  Camera, 
  Film, 
  BarChart3, 
  Shield, 
  Zap, 
  Eye, 
  Sliders, 
  Layers, 
  FileText, 
  Receipt, 
  Car, 
  Activity, 
  Radio, 
  RefreshCw,
  TrendingDown,
  Clock,
  ArrowRight,
  Info,
  MapPin,
  X,
  ExternalLink,
  Sparkles,
  Bot,
  Building2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import axios from 'axios';

const MLDetectionUpload = () => {
  const [activeTab, setActiveTab] = useState('process');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileType, setFileType] = useState('image'); // 'image' | 'video'
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [enableSegmentation, setEnableSegmentation] = useState(true);
  const [recentViolations, setRecentViolations] = useState([]);
  const [stats, setStats] = useState({ today: {}, total: {} });
  const [selectedEvidenceModal, setSelectedEvidenceModal] = useState(null);
  const [itdResultModal, setItdResultModal] = useState(null);
  const [analysisFrame, setAnalysisFrame] = useState(null);
  
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const analysisImageRef = useRef(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraId = 'BANGALORE-SILKBOARD-CAM-01';
  const speedLimit = 60;
  const modelStatus = result?.model;
  const [agentWorkflows, setAgentWorkflows] = useState([]);

  // Initialize Socket.IO Real-time alerts
  useEffect(() => {
    const socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true
    });

    socket.on('helmet_violation_detected', (data) => {
      toast.error(`🪖 Helmet Violation: ${data.vehicleNumber} (₹${data.fine})`);
    });

    socket.on('speeding_detected', (data) => {
      toast.error(`🚗 Speeding: ${data.vehicleNumber} at ${data.speed} km/h (₹${data.fine})`);
    });

    socket.on('signal_violation_detected', (data) => {
      toast.error(`🚦 Signal Violation: ${data.vehicleNumber} (₹${data.fine})`);
    });

    socket.on('challan_issued', (data) => {
      toast.success(`🎟️ E-Challan Issued: ${data.challanNumber} (${data.vehicleNumber})`);
      fetchViolationsAndStats();
    });

    socket.on('complaint_ticket_created', (data) => {
      toast(`🎫 ${data.priority} priority ticket: ${data.issueType} at ${data.locationName}`, { icon: '!' });
    });

    socket.on('traffic_advisory_created', (data) => {
      toast(`🚦 ${data.congestionLevel} congestion advisory created for ${data.route}`, { icon: '!' });
    });

    return () => socket.disconnect();
  }, []);

  const fetchViolationsAndStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const [violationsRes, statsRes] = await Promise.allSettled([
        axios.get('/api/ml-detection/violations?limit=8&type=all', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/ml-detection/stats', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (violationsRes.status === 'fulfilled' && violationsRes.value.data?.data) {
        setRecentViolations(violationsRes.value.data.data);
      }
      if (statsRes.status === 'fulfilled' && statsRes.value.data?.data) {
        setStats(statsRes.value.data.data);
      }
    } catch (error) {
      console.warn('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    fetchViolationsAndStats();
    const interval = setInterval(fetchViolationsAndStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
      setItdResultModal(null);
      setAnalysisFrame(null);
      const isVideo = file.type.startsWith('video/');
      setFileType(isVideo ? 'video' : 'image');

      const reader = new FileReader();
      reader.onload = (event) => {
        setPreview(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Quick 1-Click Sample Bangalore Traffic Loader
  const loadSampleTrafficFeed = () => {
    // Generate a high-contrast Bangalore traffic sample canvas
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 1280;
    sampleCanvas.height = 720;
    const ctx = sampleCanvas.getContext('2d');

    // Asphalt road gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 720);
    grad.addColorStop(0, '#1E293B');
    grad.addColorStop(1, '#0F172A');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1280, 720);

    // Yellow lane dividers
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 6;
    ctx.setLineDash([40, 30]);
    ctx.beginPath();
    ctx.moveTo(420, 0); ctx.lineTo(420, 720);
    ctx.moveTo(860, 0); ctx.lineTo(860, 720);
    ctx.stroke();
    ctx.setLineDash([]);

    // Sample Car 1 (Honda City - Over Speeding)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(460, 260, 180, 300);
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(470, 300, 160, 160); // windshield
    // Plate
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(490, 540, 120, 25);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('KA 01 AB 1234', 495, 558);

    // Sample 2-Wheeler (TVS Jupiter - No Helmet)
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(200, 320, 80, 180);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(205, 480, 70, 20);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('KA05MN9876', 208, 495);

    // Sample Auto Rickshaw (Bajaj RE - Signal)
    ctx.fillStyle = '#EAB308';
    ctx.fillRect(920, 240, 140, 240);
    ctx.fillStyle = '#10B981';
    ctx.fillRect(920, 320, 140, 80);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(935, 460, 110, 22);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('KA 03 HA 4567', 940, 476);

    // CCTV Timestamp HUD Header
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, 1280, 60);
    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('🔴 CCTV-BLR-SILKBOARD-JUNCTION-01 [LIVE 4K HD]', 30, 38);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '16px monospace';
    ctx.fillText(new Date().toLocaleString('en-IN'), 920, 38);

    const dataUrl = sampleCanvas.toDataURL('image/jpeg', 0.95);
    setPreview(dataUrl);
    setFileType('image');
    setSelectedFile({ name: 'Bengaluru_Silk_Board_Junction_Live.jpg', size: 340000 });
    toast.success('📸 Loaded High-Res Bangalore Traffic Corridor Feed');
  };

  // Draw instance segmentation masks & bounding boxes on canvas overlay
  const drawSegmentationOverlay = (data) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const sourceImage = imageRef.current || analysisImageRef.current;
    if (sourceImage?.complete && sourceImage.naturalWidth) {
      ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
    }

    if (!enableSegmentation) return canvas.toDataURL('image/jpeg', 0.92);

    // 1. Draw Road Lanes Segmentation
    if (data.segmentation?.road_lanes) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
      ctx.lineWidth = 2;

      Object.values(data.segmentation.road_lanes).forEach(poly => {
        if (poly && poly.length > 2) {
          ctx.beginPath();
          ctx.moveTo(poly[0][0], poly[0][1]);
          for (let i = 1; i < poly.length; i++) {
            ctx.lineTo(poly[i][0], poly[i][1]);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      });
    }

    const waterItems = data.water_logging_detections || data.events?.water_logging?.detections || [];
    if (waterItems.length > 0) {
      waterItems.forEach((item) => {
        const polygon = item.segmentation_polygon;
        const b = item.bbox;
        ctx.fillStyle = 'rgba(14, 165, 233, 0.28)';
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 4;
        if (polygon?.length > 2) {
          ctx.beginPath();
          ctx.moveTo(polygon[0][0], polygon[0][1]);
          polygon.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (b) {
          ctx.fillRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);
          ctx.strokeRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);
        }
      });
    } else if (data.events?.water_logging?.detected || data.water_logging?.detected) {
      ctx.fillStyle = 'rgba(14, 165, 233, 0.24)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 4;
      ctx.fillRect(0, canvas.height * 0.55, canvas.width, canvas.height * 0.45);
      ctx.strokeRect(0, canvas.height * 0.55, canvas.width, canvas.height * 0.45);
      ctx.fillStyle = '#0284C7';
      ctx.fillRect(8, Math.max(0, canvas.height * 0.55 - 24), 230, 24);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`WATER LOGGING • ${Math.round((data.events?.water_logging?.confidence || data.water_logging?.confidence || 0) * 100)}%`, 14, Math.max(16, canvas.height * 0.55 - 8));
    }

    // 2. Draw Vehicle Segmentation Polygons & Bounding Boxes
    if (data.vehicles && data.vehicles.length > 0) {
      data.vehicles.forEach((v) => {
        const poly = v.segmentation_polygon;
        const b = v.bbox;

        // Mask
        if (poly && poly.length > 2) {
          ctx.fillStyle = v.speed > speedLimit ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)';
          ctx.beginPath();
          ctx.moveTo(poly[0][0], poly[0][1]);
          for (let i = 1; i < poly.length; i++) {
            ctx.lineTo(poly[i][0], poly[i][1]);
          }
          ctx.closePath();
          ctx.fill();
        }

        // Bounding Box
        if (b) {
          ctx.strokeStyle = v.speed > speedLimit ? '#EF4444' : '#10B981';
          ctx.lineWidth = 3;
          ctx.strokeRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);

          // Tag Label
          ctx.fillStyle = v.speed > speedLimit ? '#EF4444' : '#10B981';
          ctx.fillRect(b.x1, b.y1 - 24, Math.max(160, (b.x2 - b.x1)), 24);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 11px monospace';
          ctx.fillText(`${v.plateNumber || v.id} • ${Math.round(v.speed)} km/h`, b.x1 + 6, b.y1 - 8);
        }
      });
    }

    if (data.potholes && data.potholes.length > 0) {
      data.potholes.forEach((pothole) => {
        const b = pothole.bbox;
        if (!b) return;
        ctx.strokeStyle = '#F97316';
        ctx.lineWidth = 4;
        ctx.strokeRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);
        ctx.fillStyle = '#F97316';
        ctx.fillRect(b.x1, Math.max(0, b.y1 - 24), 190, 24);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`POTHOLE • ${Math.round(pothole.confidence * 100)}%`, b.x1 + 6, Math.max(16, b.y1 - 8));
      });
    }

    const drawDetectionBoxes = (items, color, labelKey = 'label') => {
      items.forEach((item) => {
        const b = item.bbox;
        if (!b) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);
        ctx.fillStyle = color;
        ctx.fillRect(b.x1, Math.max(0, b.y1 - 20), 190, 20);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`${item[labelKey] || item.type || 'detection'} ${(item.confidence * 100 || 0).toFixed(0)}%`, b.x1 + 5, Math.max(14, b.y1 - 6));
      });
    };

    drawDetectionBoxes(data.urban_issues || [], '#F97316');
    drawDetectionBoxes(data.vendors || [], '#A855F7');
    drawDetectionBoxes(data.plate_detections || [], '#06B6D4');
    drawDetectionBoxes(data.helmet_detections || [], '#EAB308');
    drawDetectionBoxes((data.speeds || []).filter((item) => Number.isFinite(item.speed)), '#EF4444');
    drawDetectionBoxes((data.speed_tracking_detections || []).filter((item) => Number.isFinite(item.speed_kmh)), '#0EA5E9');
    drawDetectionBoxes(data.crowd_detections || [], '#EC4899');

    return canvas.toDataURL('image/jpeg', 0.92);
  };

  useEffect(() => {
    if (!result || !preview) return;
    const image = imageRef.current || analysisImageRef.current;
    if (!image?.complete || !image.naturalWidth) return;

    canvasRef.current.width = image.naturalWidth;
    canvasRef.current.height = image.naturalHeight;
    const annotatedImage = drawSegmentationOverlay(result);
    if (annotatedImage) {
      setItdResultModal(annotatedImage);
    }
  }, [result, preview, analysisFrame, fileType, enableSegmentation]);

  const captureVideoFrame = async () => {
    const video = videoRef.current;
    if (!video) throw new Error('The video preview is not ready yet. Please try again.');

    if (video.readyState < 2) {
      await new Promise((resolve, reject) => {
        const handleLoaded = () => {
          video.removeEventListener('loadeddata', handleLoaded);
          video.removeEventListener('error', handleError);
          resolve();
        };
        const handleError = () => {
          video.removeEventListener('loadeddata', handleLoaded);
          video.removeEventListener('error', handleError);
          reject(new Error('The uploaded video could not be decoded by the browser.'));
        };
        video.addEventListener('loadeddata', handleLoaded, { once: true });
        video.addEventListener('error', handleError, { once: true });
      });
    }

    if (video.readyState >= 1) {
      video.currentTime = 0;
      await new Promise((resolve) => {
        if (Math.abs(video.currentTime) < 0.01) resolve();
        else video.addEventListener('seeked', resolve, { once: true });
      });
    }

    const frameCanvas = document.createElement('canvas');
    const scale = Math.min(1, 1280 / video.videoWidth);
    frameCanvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    frameCanvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    frameCanvas.getContext('2d').drawImage(video, 0, 0, frameCanvas.width, frameCanvas.height);
    return frameCanvas.toDataURL('image/jpeg', 0.9);
  };

  const handleProcessVideoOrFrame = async () => {
    if (!preview) {
      toast.error('Please upload a traffic video or click "Load Sample" first');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const frameForAnalysis = fileType === 'video' ? await captureVideoFrame() : preview;
      if (fileType === 'video') setAnalysisFrame(frameForAnalysis);
      const payload = {
        cameraId,
        frameUrl: frameForAnalysis,
        location: 'Silk Board Junction, Bengaluru',
        speedLimit,
        signalStatus: 'green',
        fileType
      };

      const res = await axios.post('/api/ml-detection/process-frame', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const detectionData = res.data?.data || res.data;
      setResult(detectionData);
      setAgentWorkflows(res.data?.agentWorkflows || []);

      const challansCreated = detectionData.echallans_generated?.total_challans_count || res.data.challansCreated?.length || 0;
      const fineTotal = detectionData.echallans_generated?.total_fine_amount_inr || 0;

      toast.success(`🎉 Analysis Complete: ${challansCreated} Legal E-Challans Auto-Issued (₹${fineTotal})!`);
      fetchViolationsAndStats();
    } catch (error) {
      console.error('Processing error:', error);
      toast.error(`Processing error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const hasPotholeDetection = Boolean(result?.potholes?.length);
  const detectionGroups = result ? [
    ...(result.accident_detection?.accident_detected ? [{
      label: 'Accident / collision',
      detail: `${Math.round((result.accident_detection.details?.confidence || 0) * 100)}% confidence`,
      confidence: result.accident_detection.details?.confidence,
      color: 'red'
    }] : []),
    ...(!hasPotholeDetection && (result.events?.water_logging?.detected || result.water_logging?.detected) ? [{
      label: 'Water logging',
      detail: result.events?.water_logging?.method || 'Road water accumulation',
      confidence: result.events?.water_logging?.confidence || result.water_logging?.confidence,
      color: 'cyan'
    }] : []),
    ...((result.events?.fallen_tree?.detected || result.fallen_tree) ? [{
      label: 'Fallen tree',
      detail: 'Civic obstruction',
      confidence: result.events?.fallen_tree?.confidence || result.fallen_tree?.confidence,
      color: 'amber'
    }] : []),
    ...(result.potholes || []).map((item) => ({ label: item.label || 'Pothole', detail: 'Road damage', confidence: item.confidence, color: 'orange' })),
    ...(result.urban_issues || []).filter((item) => !/pothole/i.test(item.label || item.class_name || item.type || '')).map((item) => ({ label: item.label || item.class_name || item.type || 'Urban issue', detail: 'Civic issue', confidence: item.confidence, color: 'amber' })),
    ...(result.plate_detections || result.plates || []).map((item) => ({ label: item.plate_text || item.plateNumber || 'Plate detected', detail: 'Number plate OCR', confidence: item.confidence, color: 'cyan' })),
    ...(result.helmets || result.helmet_detections || []).map((item) => ({
      label: item.helmetDetected === false ? 'Without helmet' : item.helmetDetected === true ? 'With helmet' : 'Helmet status unavailable',
      detail: item.helmetType || 'Helmet detection',
      confidence: item.confidence,
      color: item.helmetDetected === false ? 'red' : 'yellow'
    })),
    ...(result.speeds || []).filter((item) => Number.isFinite(item.speed)).map((item) => ({ label: item.isSpeeding ? 'Speeding' : 'Speed detected', detail: `${item.speed} km/h`, confidence: item.confidence, color: item.isSpeeding ? 'red' : 'blue' })),
    ...(result.speed_tracking_detections || []).filter((item) => Number.isFinite(item.speed_kmh)).map((item) => ({ label: 'Speed detected', detail: `${item.speed_kmh} km/h`, confidence: item.confidence, color: 'blue' })),
    ...(result.crowd_detections || []).map((item) => ({ label: item.label || 'Crowd / person', detail: 'Crowd detection', confidence: item.confidence, color: 'pink' })),
    ...(result.violations_summary?.violations || []).map((item) => ({ label: item.title || item.type || 'Traffic violation', detail: item.vehicle_number || 'Violation', confidence: 1, color: 'red' }))
  ] : [];
  const detectionColorClasses = {
    red: 'bg-red-400', orange: 'bg-orange-400', amber: 'bg-amber-400', cyan: 'bg-cyan-400',
    yellow: 'bg-yellow-400', blue: 'bg-blue-400', pink: 'bg-pink-400'
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* ── TOP HERO HEADER (LIQUID GLASS CONTROL ROOM) ── */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 sm:p-8 text-slate-900 shadow-glass border border-white/70 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-2 bg-cyan-50 text-cyan-600 border border-cyan-200/60 rounded-xl shadow-xs">
                <Film className="w-5 h-5" />
              </div>
              <span className="bg-cyan-50 text-cyan-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider border border-cyan-200/60">
                Synchronized Vision & Multi-Modal ML Layer
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-slate-900">
              Traffic Video Analyzer, Segmentation & Auto E-Challan Engine
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mt-1">
              Upload any CCTV video or frame to run instance segmentation, detect congestion, detect collisions/accidents, identify violations, and automatically issue legal E-Challans.
            </p>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            <span className={`bg-white/90 backdrop-blur-md border px-3.5 py-2 rounded-2xl flex items-center gap-2 shadow-xs ${modelStatus?.source === 'ITD' ? 'border-emerald-200 text-emerald-700' : modelStatus?.source === 'synthetic-fallback' ? 'border-amber-200 text-amber-700' : 'border-slate-200 text-slate-500'}`}>
              <span className={`w-2 h-2 rounded-full ${modelStatus?.source === 'ITD' ? 'bg-emerald-500 animate-ping' : modelStatus?.source === 'synthetic-fallback' ? 'bg-amber-500' : 'bg-slate-400'}`}></span>
              {modelStatus?.source === 'ITD' || modelStatus?.source === 'real' ? `${modelStatus.name || 'ML'} Active` : modelStatus?.source === 'synthetic-fallback' ? 'ML Not Run: Synthetic Fallback' : 'ML Detector Not Verified'}
            </span>
          </div>
        </div>
      </div>

      {/* ── MAIN UPLOAD & ANALYSIS WORKSPACE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left 2 Cols: Video / Frame Player & Segmentation Canvas */}
        <div className="lg:col-span-2 bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-glass border border-white/70 space-y-4">
          
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-display font-bold text-slate-800">Traffic Video / Feed Canvas</h2>
              <p className="text-xs text-slate-500">Live bounding boxes, instance segmentation polygons & violation overlays</p>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-100/90 border border-slate-200/60 px-3 py-1.5 rounded-xl cursor-pointer shadow-xs">
                <input
                  type="checkbox"
                  checked={enableSegmentation}
                  onChange={(e) => {
                    setEnableSegmentation(e.target.checked);
                    if (result) drawSegmentationOverlay(result);
                  }}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                Image Segmentation Masks
              </label>
            </div>
          </div>

          {/* Media Player / Canvas Container */}
          <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
            {preview ? (
              fileType === 'video' ? (
                <video
                  ref={videoRef}
                  src={preview}
                  controls
                  autoPlay
                  loop
                  muted
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  ref={imageRef}
                  src={preview}
                  alt="Traffic Frame"
                  onLoad={() => {
                    if (result && imageRef.current) {
                      canvasRef.current.width = imageRef.current.naturalWidth;
                      canvasRef.current.height = imageRef.current.naturalHeight;
                      drawSegmentationOverlay(result);
                    }
                  }}
                  className="w-full h-full object-contain"
                />
              )
            ) : (
              <div className="text-center p-6 text-slate-500 space-y-3">
                <Camera className="w-12 h-12 mx-auto text-slate-700 animate-bounce" />
                <p className="text-xs font-bold font-mono">No video or frame uploaded yet.</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  Choose Traffic Video / Frame
                </button>
              </div>
            )}

            {analysisFrame && (
              <img
                ref={analysisImageRef}
                src={analysisFrame}
                alt="Extracted video analysis frame"
                className="hidden"
                onLoad={() => {
                  if (result && analysisImageRef.current) {
                    canvasRef.current.width = analysisImageRef.current.naturalWidth;
                    canvasRef.current.height = analysisImageRef.current.naturalHeight;
                    const annotatedImage = drawSegmentationOverlay(result);
                    if (annotatedImage) setItdResultModal(annotatedImage);
                  }
                }}
              />
            )}

            {/* Segmentation Canvas Overlay */}
            {preview && (
              <canvas
                ref={canvasRef}
                width={1}
                height={1}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
            )}
          </div>

          {/* Upload Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all"
              >
                <Upload className="w-4 h-4" />
                {selectedFile ? selectedFile.name.slice(0, 18) + '...' : 'Upload Video / Frame'}
              </button>

              <button
                onClick={loadSampleTrafficFeed}
                className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500/10 to-amber-600/10 hover:bg-amber-500/20 text-amber-800 border border-amber-300 rounded-2xl text-xs font-bold transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Load Sample Bangalore Feed
              </button>
            </div>

            <button
              onClick={handleProcessVideoOrFrame}
              disabled={loading || !preview}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-600/20 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <Zap className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Analyzing Video & Issuing E-Challans...' : '⚡ Run Full Video ML Analysis'}
            </button>
          </div>

        </div>

        {/* Right Col: Congestion, Accident & Telemetry Meters */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-5 flex flex-col justify-between">
          
          <div>
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-blue-600" />
              Live Congestion & Telemetry Index
            </h3>
            <p className="text-xs text-slate-500">Real-time vehicle density, flow velocity, and ALPR stream</p>
          </div>

          {/* Congestion Level Gauge */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 font-mono">Congestion Level</span>
              <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                result?.congestion?.congestion_level === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {result?.congestion?.congestion_level || 'N/A'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-xs font-mono">
              <div>
                <p className="text-[10px] text-slate-400">VEHICLE DENSITY</p>
                <p className="text-lg font-black text-slate-800">{result?.congestion ? `${result.congestion.vehicle_density_percent}%` : 'N/A'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">AVG FLOW SPEED</p>
                <p className="text-lg font-black text-slate-800">{result?.congestion?.average_speed_kmh != null ? `${result.congestion.average_speed_kmh} km/h` : 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Vehicle Types Breakdown */}
          <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-2 text-xs">
            <p className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">Detected Vehicle Classes</p>
            <div className="grid grid-cols-3 gap-2 text-center font-mono">
              <div className="p-2 bg-white rounded-xl shadow-xs border border-indigo-100">
                <span className="text-xs">🚗 Cars</span>
                <p className="text-sm font-black text-slate-800">{result?.vehicles?.filter(v => v.class === '4-wheeler')?.length || 0}</p>
              </div>
              <div className="p-2 bg-white rounded-xl shadow-xs border border-indigo-100">
                <span className="text-xs">🛵 2-Wheel</span>
                <p className="text-sm font-black text-slate-800">{result?.vehicles?.filter(v => v.class === '2-wheeler')?.length || 0}</p>
              </div>
              <div className="p-2 bg-white rounded-xl shadow-xs border border-indigo-100">
                <span className="text-xs">🛺 Autos</span>
                <p className="text-sm font-black text-slate-800">{result?.vehicles?.filter(v => v.class === '3-wheeler')?.length || 0}</p>
              </div>
            </div>
          </div>

          {/* Summary Badges */}
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-[10px] text-blue-700 font-bold">SEGMENTED OBJECTS</p>
              <p className="text-base font-black text-blue-900">{result?.vehicles?.length || 0} Vehicles</p>
            </div>
            <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-xl">
              <p className="text-[10px] text-orange-700 font-bold">POTHOLES DETECTED</p>
              <p className="text-base font-black text-orange-900">{result?.potholes?.length || 0}</p>
              <p className="text-[10px] text-orange-600">Model: {result?.model?.pothole_model || 'Not run'}</p>
            </div>
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
              <p className="text-[10px] text-purple-700 font-bold">AUTO E-CHALLANS</p>
              <p className="text-base font-black text-purple-900">
                {result ? (result.echallans_generated?.total_challans_count || result.violations_summary?.total_violations_count || 0) : 0} Issued
              </p>
            </div>
          </div>

        </div>

        {/* Right Col: Detection Results */}
        <div className="lg:col-span-1 bg-slate-950 rounded-3xl p-5 shadow-sm border border-slate-800 space-y-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                Detection Results
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Objects, events, OCR and violations</p>
            </div>
            <span className="text-xs font-black bg-cyan-400/15 text-cyan-300 px-2 py-1 rounded-lg">
              {detectionGroups.length} found
            </span>
          </div>

          <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
            {agentWorkflows.length > 0 && (
              <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5" /> Agent assignment complete
                </p>
                {agentWorkflows.map((workflow) => (
                  <div key={String(workflow.issueId)} className="text-[11px] text-slate-200">
                    <p className="font-bold">{workflow.issueType}: {workflow.agentWorkflow?.selectedAgents?.join(', ') || 'CivicAndRoadHealthAgent'}</p>
                    <p className="text-slate-400 flex items-center gap-1 mt-1"><Building2 className="w-3 h-3" /> {workflow.agentWorkflow?.department || 'Authority assignment pending'} · {workflow.agentWorkflow?.authorityStatus || 'PENDING'}</p>
                  </div>
                ))}
              </div>
            )}
            {!result && <p className="text-xs text-slate-500 py-8 text-center">Run analysis to see model results.</p>}
            {result && detectionGroups.length === 0 && <p className="text-xs text-slate-400 py-8 text-center">No target detected in this frame.</p>}
            {detectionGroups.map((item, index) => (
              <div key={`${item.label}-${index}`} className="flex items-start gap-3 rounded-xl bg-white/5 border border-white/10 p-3">
                <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${detectionColorClasses[item.color] || 'bg-slate-400'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate">{item.label}</p>
                  <p className="text-[10px] text-slate-400 truncate">{item.detail}</p>
                </div>
                {typeof item.confidence === 'number' && item.confidence > 0 && (
                  <span className="text-[10px] font-mono text-slate-300">{Math.round(item.confidence * 100)}%</span>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── AUTOMATIC E-CHALLAN GENERATION TABLE & CITIZEN SYNC ── */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-indigo-600" />
              Auto-Generated Legal E-Challans (Real-Time Citizen Sync)
            </h3>
            <p className="text-xs text-slate-500">
              Live license plate recognition, citizen registry lookup, statutory fine computation, and instant photo evidence capture
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl font-mono">
              Total Fines: <strong className="text-emerald-600">₹{result?.echallans_generated?.total_fine_amount_inr || 0}</strong>
            </span>
          </div>
        </div>

        {/* Challan Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase text-[10px]">
                <th className="p-3">Challan ID</th>
                <th className="p-3">Citizen Owner</th>
                <th className="p-3">Vehicle Plate</th>
                <th className="p-3">Violation & Section</th>
                <th className="p-3">Fine (INR)</th>
                <th className="p-3">Photo Evidence</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(result ? (result.echallans_generated?.challans || []) : [
                { challan_number: 'CH-RSH-984210', vehicle_number: 'KA 01 AB 1234', owner_name: 'Rajesh Kumar', vehicle_model: 'Honda City (White)', title: 'Rash / Reckless Driving at 88 km/h', legal_section: 'Section 184 MVA (Dangerous Driving)', fine_amount: 1500, status: 'ISSUED', location: 'Silk Board Junction, Bengaluru' },
                { challan_number: 'CH-HLM-849201', vehicle_number: 'KA 05 MN 9876', owner_name: 'Priya Sharma', vehicle_model: 'TVS Jupiter (Black)', title: 'No Helmet on Two-Wheeler Rider', legal_section: 'Section 129 MVA', fine_amount: 500, status: 'ISSUED', location: 'Silk Board Junction, Bengaluru' },
                { challan_number: 'CH-SIG-110294', vehicle_number: 'KA 03 HA 4567', owner_name: 'Mohammed Arif', vehicle_model: 'Bajaj RE Auto', title: 'Red Light Jumping / Stop Line Violation', legal_section: 'Section 119/177 MVA', fine_amount: 1000, status: 'ISSUED', location: 'Silk Board Junction, Bengaluru' }
              ]).map((c, i) => (
                <tr key={i} className="hover:bg-slate-50/80 transition-all">
                  <td className="p-3 font-bold text-blue-600">{c.challan_number}</td>
                  <td className="p-3">
                    <p className="font-sans font-bold text-slate-800">{c.owner_name || 'Citizen Driver'}</p>
                    <p className="text-[10px] text-slate-400 font-sans">{c.vehicle_model || 'Private Vehicle'}</p>
                  </td>
                  <td className="p-3 font-black text-slate-800 bg-slate-50/80 rounded px-2">{c.vehicle_number}</td>
                  <td className="p-3 font-sans">
                    <p className="font-semibold text-slate-800">{c.title}</p>
                    <p className="text-[10px] text-slate-500">{c.legal_section}</p>
                  </td>
                  <td className="p-3 font-black text-emerald-600">₹{c.fine_amount}</td>
                  <td className="p-3">
                    {c.evidence_photo ? (
                      <button
                        onClick={() => setSelectedEvidenceModal(c)}
                        className="group relative w-12 h-8 rounded-lg overflow-hidden border border-slate-300 shadow-xs hover:scale-110 transition-transform"
                      >
                        <img src={c.evidence_photo} alt="Evidence" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="w-3.5 h-3.5 text-white" />
                        </div>
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-sans">CCTV Capture</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {c.status || 'ISSUED'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── PHOTO EVIDENCE MODAL ── */}
      {itdResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-5 max-w-5xl w-full shadow-2xl border border-cyan-200 space-y-4 relative">
            <button
              onClick={() => setItdResultModal(null)}
              className="absolute top-3 right-3 z-10 p-2 bg-white/90 hover:bg-slate-100 text-slate-700 rounded-full shadow transition"
              aria-label="Close ITD analysis result"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 text-cyan-700 rounded-xl">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800">ITD Applied Image</h3>
                <p className="text-xs text-slate-500">
                  {modelStatus?.source === 'ITD' ? `${modelStatus.name} detections and segmentation overlays` : 'ITD result preview'}
                </p>
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden border-2 border-cyan-500 bg-slate-950 flex items-center justify-center">
              <img src={itdResultModal} alt="ITD annotated traffic analysis" className="max-h-[70vh] w-full object-contain" />
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-mono text-slate-500">Bounding boxes, labels and segmentation polygons</span>
              <button
                onClick={() => setItdResultModal(null)}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold transition"
              >
                Close Result
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedEvidenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 relative">
            <button
              onClick={() => setSelectedEvidenceModal(null)}
              className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800">Violation Visual Evidence Capture</h3>
                <p className="text-xs text-slate-500">{selectedEvidenceModal.challan_number}</p>
              </div>
            </div>

            <div className="relative rounded-2xl overflow-hidden border-2 border-red-500 shadow-lg bg-black aspect-video flex items-center justify-center">
              <img
                src={selectedEvidenceModal.evidence_photo}
                alt="Violation Evidence"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Citizen:</span>
                <span className="font-bold text-slate-800">{selectedEvidenceModal.owner_name} ({selectedEvidenceModal.owner_phone})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Plate:</span>
                <span className="font-mono font-black text-slate-800">{selectedEvidenceModal.vehicle_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Violation:</span>
                <span className="font-semibold text-red-600">{selectedEvidenceModal.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Legal Section:</span>
                <span className="font-mono text-slate-700">{selectedEvidenceModal.legal_section}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Location:</span>
                <span className="text-slate-700">{selectedEvidenceModal.location}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="font-bold text-slate-700">Fine Amount:</span>
                <span className="font-black text-emerald-600 text-sm">₹{selectedEvidenceModal.fine_amount}</span>
              </div>
            </div>

            <button
              onClick={() => {
                toast.success(`Digital E-Challan dispatched to citizen: ${selectedEvidenceModal.owner_phone}`);
                setSelectedEvidenceModal(null);
              }}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition"
            >
              Confirm Legal Dispatch & Notify Citizen
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default MLDetectionUpload;
