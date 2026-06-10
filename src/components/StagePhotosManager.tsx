import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  Trash2, 
  Calendar, 
  User, 
  Image as ImageIcon, 
  Tag, 
  Maximize2, 
  CheckCircle2, 
  Clock, 
  Plus, 
  ChevronRight,
  AlertCircle,
  Sparkles,
  Play,
  Download
} from 'lucide-react';
import { Project, UserRole } from '../types';

interface StagePhotosManagerProps {
  activeProject: Project | null;
  currentUserRole: UserRole;
  currentUserName: string;
}

export interface StagePhoto {
  id: string;
  projectId: string;
  stageKey: string;
  photoUrl: string; // Base64 or Unsplash fallback
  remarks: string;
  uploadedBy: string;
  date: string;
}

interface MilestoneStage {
  key: string;
  title: string;
  description: string;
  typicalWeight: string;
}

const CONSTRUCT_STAGES: MilestoneStage[] = [
  { key: 'excavation', title: 'Site Excavation', description: 'Digging of foundation trenches, column pits, and soil leveling', typicalWeight: '10%' },
  { key: 'foundation', title: 'Foundation & Concrete Footing', description: 'Steel grid lay, concrete footing casting & base column rise', typicalWeight: '20%' },
  { key: 'plinth', title: 'Plinth Level & DPC Beam', description: 'Ground tie-beam casting, soil refilling, and damp proof course lay', typicalWeight: '30%' },
  { key: 'pillars', title: 'RCC Columns & Framing', description: 'Raising solid pillars, column shuttering, and vertical load frames', typicalWeight: '45%' },
  { key: 'roof_slab', title: 'Roof Slab casting (Concrete RCC)', description: 'Centering, steel rebar mesh layout, electrical tube insertion & concreting', typicalWeight: '60%' },
  { key: 'brickwork', title: 'Brick Masonry Walls', description: 'Raising perimeter/partition walls using fly-ash or clay solid bricks', typicalWeight: '75%' },
  { key: 'plastering', title: 'Plastering & Conduits', description: 'Smooth wall cement finish plastering & internal wall channelling', typicalWeight: '85%' },
  { key: 'flooring', title: 'Tiling, Flooring & Plumbing', description: 'Laying vitrified tiles/marbles, pipelines, sanitary fittings and windows', typicalWeight: '92%' },
  { key: 'painting', title: 'Painting & Finishing', description: 'Double coat putty wall primers, premium emulsion painting & electrical fixtures', typicalWeight: '98%' },
  { key: 'handover', title: 'Completion & Key Handover', description: 'De-shuttering cleanup, safety cert auditing, and handing keys to owner', typicalWeight: '100%' }
];

// Seed stock photos of actual construction to ensure the portal looks highly professional right out of the box
const DEFAULT_PRESETS: Omit<StagePhoto, 'id'>[] = [
  {
    projectId: 'all',
    stageKey: 'excavation',
    photoUrl: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=800&q=80',
    remarks: 'Excavation to depth of 10 feet completed for primary grid columns. Ground leveled and approved.',
    uploadedBy: 'Nagaraj S',
    date: '2026-06-01'
  },
  {
    projectId: 'all',
    stageKey: 'foundation',
    photoUrl: 'https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&w=800&q=80',
    remarks: 'Reinforced concrete foundation casting completed. Footing reinforcement mats aligned by steelworkers.',
    uploadedBy: 'Nagaraj S',
    date: '2026-06-03'
  },
  {
    projectId: 'all',
    stageKey: 'pillars',
    photoUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
    remarks: 'Pillars and columns framed and shuttered. Wet curing is active twice-daily.',
    uploadedBy: 'Nagaraj S',
    date: '2026-06-05'
  }
];

export default function StagePhotosManager({
  activeProject,
  currentUserRole,
  currentUserName,
}: StagePhotosManagerProps) {

  const [photos, setPhotos] = useState<StagePhoto[]>([]);
  const [selectedStage, setSelectedStage] = useState<string>('excavation');
  
  // Upload photo form states
  const [dragActive, setDragActive] = useState(false);
  const [photoInput, setPhotoInput] = useState<string>('');
  const [remarksInput, setRemarksInput] = useState<string>('');
  const [dateInput, setDateInput] = useState<string>(new Date().toISOString().split('T')[0]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Zoom light box
  const [lightboxImage, setLightboxImage] = useState<StagePhoto | null>(null);

  // Load photos from local storage
  useEffect(() => {
    const raw = localStorage.getItem('lv_stage_photos');
    if (raw) {
      setPhotos(JSON.parse(raw));
    } else {
      // Seed initial photos for high-end look
      const seeded: StagePhoto[] = DEFAULT_PRESETS.map((p, idx) => ({
        ...p,
        id: `photo_seed_${idx}`
      }));
      setPhotos(seeded);
      localStorage.setItem('lv_stage_photos', JSON.stringify(seeded));
    }
  }, []);

  const savePhotos = (updated: StagePhoto[]) => {
    setPhotos(updated);
    localStorage.setItem('lv_stage_photos', JSON.stringify(updated));
  };

  if (!activeProject) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center max-w-xl mx-auto my-12 shadow-sm">
        <Camera className="w-16 h-16 mx-auto text-slate-350 stroke-[1.25] mb-4" />
        <h3 className="text-lg font-bold text-slate-800">Select Project for Stage Photos</h3>
        <p className="text-slate-550 mt-2 text-xs leading-relaxed max-w-sm mx-auto">
          Please choose an active construction site from the top sidebar drop-down to access and review site visual development stages.
        </p>
      </div>
    );
  }

  // Filter photos for current project (we match either standard seed 'all' or activeProject.id)
  const projectPhotos = photos.filter(p => p.projectId === 'all' || p.projectId === activeProject.id);
  
  // Group photos by stage key
  const getPhotosForStage = (key: string) => projectPhotos.filter(p => p.stageKey === key);

  // Convert raw files to Base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Only image file types are supported (JPG, PNG, WEBP).');
      return;
    }

    // Limit to 5MB for storage stability
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image size exceeds 5MB limit. Please compress first.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setPhotoInput(event.target.result as string);
        setUploadError(null);
      }
    };
    reader.onerror = () => {
      setUploadError('Failed reading selected image file.');
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop mechanics
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    // 1. First prioritize local files dragged from the user's computer
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setUploadError('Only image files are permitted (JPG, PNG, WEBP).');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setUploadError('Image size exceeds 5MB limit. Please compress first.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotoInput(event.target.result as string);
          setUploadError(null);
        }
      };
      reader.readAsDataURL(file);
      return;
    }

    // 2. Secondary path: Retrieve dragged image elements or links from web sources
    try {
      // Look for dropped HTML markup (handles dragging/copying direct image element from websites/tabs)
      const html = e.dataTransfer.getData('text/html');
      let foundUrl = '';

      if (html) {
        const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (match && match[1]) {
          foundUrl = match[1];
        }
      }

      // Fallback: search common text URL formats
      if (!foundUrl) {
        foundUrl = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('URL') || e.dataTransfer.getData('text/plain');
      }

      if (foundUrl && foundUrl.trim()) {
        const cleanUrl = foundUrl.trim();
        // Allow HTTP addresses, secure HTTPS addresses, or inline base64 data URLs
        if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://') || cleanUrl.startsWith('data:image/')) {
          setPhotoInput(cleanUrl);
          setUploadError(null);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to parse dragged web asset:', err);
    }

    setUploadError('No valid image file or web photo link detected.');
  };

  // Clipboard Paste Support for high flexibility (Copy & Paste images)
  const handlePaste = (e: React.ClipboardEvent) => {
    // 1. Look for pasted file streams (such as screenshots, printscreen or copied files)
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          if (file.size > 5 * 1024 * 1024) {
            setUploadError('Pasted image size exceeds the 5MB limit.');
            return;
          }
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              setPhotoInput(event.target.result as string);
              setUploadError(null);
            }
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    }

    // 2. Look for pasted URL text strings or inline image embeds
    try {
      const text = e.clipboardData.getData('text/plain');
      if (text && (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('data:image/'))) {
        setPhotoInput(text.trim());
        setUploadError(null);
        return;
      }

      const html = e.clipboardData.getData('text/html');
      if (html) {
        const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (match && match[1]) {
          const cleanUrl = match[1].trim();
          if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://') || cleanUrl.startsWith('data:image/')) {
            setPhotoInput(cleanUrl);
            setUploadError(null);
            return;
          }
        }
      }
    } catch (err) {
      console.error('Failed to parse pasted clipboard content:', err);
    }
  };

  const handlePhotoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoInput) {
      setUploadError('Please select a photo file or drag an image into the upload block.');
      return;
    }

    const newPhoto: StagePhoto = {
      id: `photo_${Date.now()}`,
      projectId: activeProject.id,
      stageKey: selectedStage,
      photoUrl: photoInput,
      remarks: remarksInput.trim() || `Recorded status photo for ${CONSTRUCT_STAGES.find(s => s.key === selectedStage)?.title}.`,
      uploadedBy: currentUserName,
      date: dateInput
    };

    const updated = [newPhoto, ...photos];
    savePhotos(updated);
    
    // Reset fields
    setPhotoInput('');
    setRemarksInput('');
    setUploadError(null);
  };

  const handleDeletePhoto = (photoId: string) => {
    if (window.confirm('Do you really want to delete this development photo record from logs?')) {
      const filtered = photos.filter(p => p.id !== photoId);
      savePhotos(filtered);
      if (lightboxImage?.id === photoId) setLightboxImage(null);
    }
  };

  const handleDownloadPhoto = (photoUrl: string, stageKey: string, date: string) => {
    const stageTitle = CONSTRUCT_STAGES.find(s => s.key === stageKey)?.title || 'stage_photo';
    const cleanTitle = `${stageTitle.replace(/\s+/g, '_')}_${date}`;
    if (photoUrl.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = photoUrl;
      let ext = 'jpg';
      if (photoUrl.startsWith('data:image/png')) ext = 'png';
      else if (photoUrl.startsWith('data:image/webp')) ext = 'webp';
      link.download = `${cleanTitle}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Open online presets in new tab for direct reference
      window.open(photoUrl, '_blank');
    }
  };

  // Render a visual completion count
  const completedStagesList = CONSTRUCT_STAGES.filter(stage => getPhotosForStage(stage.key).length > 0);
  const computedProgressPercent = Math.round((completedStagesList.length / CONSTRUCT_STAGES.length) * 100);

  // Mestris have write permissions, Administrators have full permission
  const hasWritePermission = currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.MESTRI;

  return (
    <div id="stage-photos-manager-container" className="space-y-6">
      
      {/* Visual Header Grid Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Core title banner */}
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-850 p-6 rounded-3xl border border-slate-800 text-white flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-extrabold uppercase rounded-full text-[9px] tracking-widest inline-flex items-center gap-1.5 leading-none">
              <Sparkles className="w-3 h-3 text-emerald-400" /> Stage-Wise Visual Audits
            </span>
            <h2 className="text-2xl font-extrabold tracking-tight">Construction Development Timeline</h2>
            <p className="text-slate-400 text-xs leading-relaxed max-w-xl">
              Chronologically archive actual photographic snapshots for each key milestone. Maintains an indisputable visual record for proprietors and architectural compliance.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-10">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider leading-none">Selected Site</span>
                <span className="text-xs font-extrabold text-slate-200 mt-1 block">{activeProject.projectName}</span>
              </div>
              <div className="h-6 w-px bg-slate-800"></div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider leading-none">Coded Status</span>
                <span className="text-[10px] text-emerald-400 font-extrabold shadow-sm bg-emerald-500/10 border border-emerald-500/10 px-2 py-0.5 rounded-md mt-1 inline-block">
                  {completedStagesList.length} / 10 Milestones Tracked
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Circular Progress Gauge block */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Site Completion Est.</h4>
              <p className="text-xs text-slate-400">Based on tracked development stages</p>
            </div>
            <span className="p-1 px-2.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-extrabold text-slate-500">
              LV Track v2.1
            </span>
          </div>

          <div className="py-4 flex items-center justify-center gap-6">
            {/* Visual Arc Percentage */}
            <div className="relative flex items-center justify-center w-20 h-20">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="40" cy="40" r="32" className="stroke-slate-100" strokeWidth="6" fill="transparent" />
                <circle cx="40" cy="40" r="32" className="stroke-emerald-500 transition-all duration-1000" strokeWidth="6" strokeDasharray={`${2 * Math.PI * 32}`} strokeDashoffset={`${2 * Math.PI * 32 * (1 - computedProgressPercent / 100)}`} fill="transparent" strokeLinecap="round" />
              </svg>
              <span className="absolute text-base font-black text-slate-800">{computedProgressPercent}%</span>
            </div>

            <div className="space-y-1.5">
              <h5 className="text-2xl font-black text-slate-800 tracking-tight">Active Phase</h5>
              <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                {completedStagesList.length === 0 
                  ? 'Ready for initial excavation' 
                  : completedStagesList.length === 10
                  ? 'All milestones logged & fully closed!'
                  : `Currently progressing at Phase ${completedStagesList.length + 1}`}
              </p>
            </div>
          </div>

          <div className="h-1 bg-slate-100 w-full rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${computedProgressPercent}%` }}></div>
          </div>
        </div>

      </div>

      {/* Main Double Grid workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side Stages Index list (4 columns in lg) */}
        <div className="lg:col-span-5 bg-white border border-slate-100 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="space-y-1 pb-2 border-b border-slate-150">
            <h3 className="font-extrabold text-slate-800 text-sm">Site Progress Workstages</h3>
            <p className="text-xs text-slate-400">Click a milestone level to inspect logged photos or submit fresh updates.</p>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[500px] pr-1" id="timeline-stages-checklist">
            {CONSTRUCT_STAGES.map((stage, idx) => {
              const stageLoggedPhotos = getPhotosForStage(stage.key);
              const isActive = selectedStage === stage.key;
              const isDone = stageLoggedPhotos.length > 0;

              return (
                <button
                  id={`stage-selector-btn-${stage.key}`}
                  key={stage.key}
                  onClick={() => {
                    setSelectedStage(stage.key);
                    setUploadError(null);
                  }}
                  className={`w-full text-left p-3.5 rounded-2xl flex items-center justify-between border transition-all cursor-pointer select-none group ${
                    isActive 
                      ? 'border-slate-900 bg-slate-900 text-white shadow-md' 
                      : 'border-slate-150 bg-slate-50 hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Circle Stage Order Index or Completion Checkmark */}
                    {isDone ? (
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-extrabold text-xs transition-colors shrink-0 ${
                        isActive ? 'bg-emerald-500 text-white' : 'bg-emerald-50 border border-emerald-200 text-emerald-600'
                      }`}>
                        <CheckCircle2 className="w-4.5 h-4.5" />
                      </div>
                    ) : (
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-[10px] shrink-0 ${
                        isActive ? 'bg-white/10 text-white border border-white/20' : 'bg-slate-200 text-slate-500'
                      }`}>
                        {idx + 1}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold truncate">{stage.title}</span>
                        <span className={`text-[8px] font-black uppercase px-1 py-0.5 rounded ${
                          isActive 
                            ? 'bg-white/15 text-slate-300' 
                            : 'bg-slate-200/60 text-slate-550'
                        }`}>
                          {stage.typicalWeight}
                        </span>
                      </div>
                      <p className={`text-[10px] mt-0.5 truncate leading-none ${
                        isActive ? 'text-slate-300' : 'text-slate-400'
                      }`}>
                        {stage.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pl-1">
                    {stageLoggedPhotos.length > 0 && (
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                        isActive ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {stageLoggedPhotos.length} {stageLoggedPhotos.length === 1 ? 'Foto' : 'Fotos'}
                      </span>
                    )}
                    <ChevronRight className={`w-4 h-4 transition-transform ${
                      isActive ? 'text-emerald-400 translate-x-1.5' : 'text-slate-400 group-hover:translate-x-1'
                    }`} />
                  </div>

                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side Photo list or upload console */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Active Stage Header Block */}
          {(() => {
            const currentStageObj = CONSTRUCT_STAGES.find(s => s.key === selectedStage);
            const activeStagePhotos = getPhotosForStage(selectedStage);

            return (
              <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-6">
                
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block leading-none">Displaying Milestone Category:</span>
                    <h3 className="text-lg font-black text-slate-800 tracking-tight">
                      {currentStageObj?.title}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {currentStageObj?.description}
                    </p>
                  </div>

                  <div className="p-1 px-3 bg-slate-50 border border-slate-150 rounded-xl text-center">
                    <span className="text-[9px] text-slate-400 font-bold block uppercase leading-none">Category weight</span>
                    <span className="text-sm font-black text-slate-800">{currentStageObj?.typicalWeight} completion code</span>
                  </div>
                </div>

                {/* Grid list of pictures uploaded for this stage */}
                {activeStagePhotos.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 border-2 border-dashed border-slate-105 rounded-2xl flex flex-col items-center justify-center space-y-2">
                    <ImageIcon className="w-10 h-10 text-slate-300 stroke-[1.25]" />
                    <p className="text-xs font-bold text-slate-700">No Visual Records Uploaded Yet</p>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                      There are no progress photographs registered for this construction stage.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {activeStagePhotos.map((photo) => (
                      <div 
                        id={`stage-photo-card-${photo.id}`}
                        key={photo.id}
                        className="bg-slate-50 rounded-2xl border border-slate-150 overflow-hidden flex flex-col justify-between group hover:border-slate-300 transition-all shadow-xs"
                      >
                        <div className="relative aspect-video w-full overflow-hidden bg-slate-200">
                          <img 
                            src={photo.photoUrl} 
                            alt={photo.remarks}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-501"
                          />
                          
                          {/* Top floating overlay */}
                          <div className="absolute top-2.5 right-2.5 flex gap-1.5 opacity-90">
                            <button
                              onClick={() => setLightboxImage(photo)}
                              className="p-1.5 bg-white/95 hover:bg-white text-slate-800 rounded-lg shadow-sm cursor-pointer hover:scale-105 transition-transform"
                              title="Full Screen View"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDownloadPhoto(photo.photoUrl, photo.stageKey, photo.date)}
                              className="p-1.5 bg-white/95 hover:bg-white text-slate-800 rounded-lg shadow-sm cursor-pointer hover:scale-105 transition-transform"
                              title="Download Photo"
                            >
                              <Download className="w-3.5 h-3.5 text-slate-650" />
                            </button>
                            
                            {/* Delete Button (Only Admin or the uploader themselves) */}
                            {currentUserRole === UserRole.ADMIN && (
                              <button
                                onClick={() => handleDeletePhoto(photo.id)}
                                className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm cursor-pointer hover:scale-105 transition-transform"
                                title="Delete Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-xs text-[9px] font-bold text-white px-2 py-0.5 rounded-md">
                            <Calendar className="w-2.5 h-2.5" /> {photo.date}
                          </div>
                        </div>

                        {/* Text and context elements */}
                        <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                          <p className="text-[11px] text-slate-700 leading-relaxed font-medium font-sans">
                            {photo.remarks}
                          </p>

                          <div className="flex justify-between items-center border-t border-slate-200/50 pt-2.5 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                            <span className="flex items-center gap-1 text-slate-600">
                              <User className="w-3 h-3 text-slate-400" /> Upload: {photo.uploadedBy}
                            </span>
                            <span className="text-[8px] font-black font-mono">ID: {photo.id.toUpperCase().split('_')[1] || photo.id}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Supervisor/Admin Photo Upload Controller Form */}
                {hasWritePermission ? (
                  <form onSubmit={handlePhotoSubmit} onPaste={handlePaste} className="bg-slate-50 rounded-2xl border border-slate-150 p-4 space-y-4">
                    <div className="flex items-center gap-1.5 pb-2 border-b border-slate-200/60">
                      <Camera className="w-4.5 h-4.5 text-slate-600" />
                      <h4 className="text-xs font-extrabold text-slate-800">Submit Progress Snapshot (Stage: {currentStageObj?.title})</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      {/* Photo drag input area */}
                      <div className="space-y-1.5 ">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Capture File Attachment</label>
                        
                        {photoInput ? (
                          <div className="border border-slate-200 rounded-xl bg-white p-2.5 relative flex flex-col items-center justify-center gap-2">
                            <img 
                              src={photoInput} 
                              alt="Upload preview" 
                              referrerPolicy="no-referrer"
                              className="max-h-24 w-auto object-cover rounded-md"
                            />
                            <button
                              type="button"
                              onClick={() => setPhotoInput('')}
                              className="text-[10px] font-extrabold text-rose-500 hover:text-rose-600 uppercase flex items-center gap-0.5 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Remove Attachment
                            </button>
                          </div>
                        ) : (
                          <div
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer flex flex-col items-center justify-center transition-all focus:outline-none focus:border-emerald-500 focus:bg-emerald-50/5 ${
                              dragActive 
                                ? 'border-emerald-500 bg-emerald-50/10' 
                                : 'border-slate-250 hover:border-slate-350 bg-white'
                            }`}
                          >
                            <Upload className="w-6 h-6 text-slate-400 mb-1" />
                            <p className="text-[10px] font-bold text-slate-700">Drag & Drop or Paste Image</p>
                            <p className="text-[9px] text-slate-400 mt-0.5">JPG, WEBP, PNG up to 5MB, or Copy-Paste image URL</p>
                            
                            <input 
                              id="stage-photo-picker-input"
                              type="file" 
                              accept="image/*"
                              onChange={handleFileChange}
                              className="hidden" 
                            />
                            <button
                              type="button"
                              onClick={() => document.getElementById('stage-photo-picker-input')?.click()}
                              className="mt-2.5 px-3 py-1 bg-slate-900 text-white rounded-lg text-[9px] font-black hover:bg-slate-950 cursor-pointer"
                            >
                              Select Photo
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Inputs panel */}
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label htmlFor="stage-photo-date" className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Capture Date</label>
                          <input
                            id="stage-photo-date"
                            type="date"
                            required
                            value={dateInput}
                            onChange={(e) => setDateInput(e.target.value)}
                            className="bg-white border border-slate-250 w-full px-3 py-2 rounded-xl text-xs font-semibold outline-slate-400"
                          />
                        </div>

                        <div className="space-y-1">
                          <label htmlFor="stage-photo-remarks" className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Remarks & Progress Status</label>
                          <textarea
                            id="stage-photo-remarks"
                            rows={2}
                            required
                            placeholder="Describe what has been completed, any curing delays, quality audit notes, etc."
                            value={remarksInput}
                            onChange={(e) => setRemarksInput(e.target.value)}
                            className="bg-white border border-slate-250 w-full px-3 py-1.5 rounded-xl text-xs font-semibold outline-slate-400 placeholder-slate-400"
                          />
                        </div>
                      </div>

                    </div>

                    {uploadError && (
                      <p className="text-[11px] text-rose-500 font-extrabold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {uploadError}
                      </p>
                    )}

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Save Visual Stage Record
                      </button>
                    </div>

                  </form>
                ) : (
                  <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 text-amber-800 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-extrabold">View Only Authorized</p>
                      <p className="text-[10px] text-amber-600 font-semibold leading-relaxed mt-0.5">
                        Your account ({currentUserRole}) is structured as an Auditor or Partner. Concrete photo updates are managed by the site supervisor Ramesh Singh / Nagaraj S or the admin representative.
                      </p>
                    </div>
                  </div>
                )}

              </div>
            );
          })()}

        </div>

      </div>

      {/* Full screen visual element lightbox zoom */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-500 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div 
            className="max-w-4xl w-full bg-white rounded-3xl overflow-hidden border border-slate-100/10 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Visual Top Bar */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="space-y-0.5">
                <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md inline-block">
                  {CONSTRUCT_STAGES.find(s => s.key === lightboxImage.stageKey)?.title}
                </span>
                <h4 className="text-sm font-extrabold text-slate-800">Visual Timeline Log: {lightboxImage.date}</h4>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleDownloadPhoto(lightboxImage.photoUrl, lightboxImage.stageKey, lightboxImage.date)}
                  className="flex items-center gap-1 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Download Snapshot
                </button>
                <button
                  onClick={() => setLightboxImage(null)}
                  className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-full cursor-pointer transition-colors"
                >
                  ✕ Close Preview
                </button>
              </div>
            </div>

            {/* Picture block */}
            <div className="relative bg-slate-900 flex justify-center items-center p-2" style={{ maxHeight: '70vh' }}>
              <img 
                src={lightboxImage.photoUrl} 
                alt="Enlarged" 
                referrerPolicy="no-referrer"
                className="max-h-[65vh] w-auto h-auto object-contain"
              />
            </div>

            {/* Metadata information bar */}
            <div className="p-5 space-y-3 bg-white">
              <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Supervisor remarks:</span>
              <p className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-150">
                {lightboxImage.remarks}
              </p>

              <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-500 font-bold uppercase border-t border-slate-100 pt-3">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" /> Logged By: <strong className="text-slate-700">{lightboxImage.uploadedBy}</strong>
                </span>
                <span>Date Recorded: <strong className="text-slate-705">{lightboxImage.date}</strong></span>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
