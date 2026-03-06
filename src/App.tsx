import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Image as ImageIcon, 
  Tag as TagIcon, 
  X, 
  Loader2, 
  Upload,
  Filter,
  ChevronRight,
  Edit2,
  Trash2,
  Copy,
  Check,
  Maximize2,
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GalleryImage {
  id: number;
  image_data: string;
  prompt_original: string;
  prompt_en: string;
  prompt_zh: string;
  tags: string;
  created_at: string;
}

export default function App() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Edit state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<GalleryImage | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editNewTag, setEditNewTag] = useState('');

  // View state
  const [viewingImage, setViewingImage] = useState<GalleryImage | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  // Upload form state
  const [uploadPrompt, setUploadPrompt] = useState('');
  const [uploadImage, setUploadImage] = useState<string | null>(null);
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchImages();
    fetchTags();
  }, [searchQuery, selectedTag]);

  const fetchImages = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedTag) params.append('tag', selectedTag);
      
      const response = await fetch(`/api/images?${params.toString()}`);
      const data = await response.json();
      setImages(data);
    } catch (error) {
      console.error('Error fetching images:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await fetch('/api/tags');
      const data = await response.json();
      setAvailableTags(data);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        
        // Check if file size > 1MB (approx 1.37 million characters in base64)
        if (file.size > 1024 * 1024) {
          const compressed = await compressImage(base64);
          setUploadImage(compressed);
        } else {
          setUploadImage(base64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const compressImage = (base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Max dimension for 1MB target (rough estimate)
        const MAX_WIDTH = 1600;
        if (width > MAX_WIDTH) {
          height = (height * MAX_WIDTH) / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG with 0.7 quality
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    });
  };

  const handleAddTag = (isEdit = false) => {
    const tag = isEdit ? editNewTag : newTag;
    const tags = isEdit ? editTags : uploadTags;
    const setTags = isEdit ? setEditTags : setUploadTags;
    const setNew = isEdit ? setEditNewTag : setNewTag;

    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setNew('');
    }
  };

  const handleRemoveTag = (tag: string, isEdit = false) => {
    const tags = isEdit ? editTags : uploadTags;
    const setTags = isEdit ? setEditTags : setUploadTags;
    setTags(tags.filter(t => t !== tag));
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadImage || !uploadPrompt) return;

    setUploading(true);
    try {
      const response = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_data: uploadImage,
          prompt: uploadPrompt,
          tags: uploadTags
        })
      });

      if (response.ok) {
        setIsUploadModalOpen(false);
        setUploadPrompt('');
        setUploadImage(null);
        setUploadTags([]);
        fetchImages();
        fetchTags();
      } else {
        const errorData = await response.json();
        alert(`Upload failed: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('An unexpected error occurred during upload.');
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = async (text: string, id: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDelete = async (id: number) => {
    // Two-step confirmation logic
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      // Auto-reset after 3 seconds
      setTimeout(() => setDeleteConfirmId(null), 3000);
      return;
    }

    setIsDeleting(id);
    try {
      const response = await fetch(`/api/images/${id}`, { 
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        await fetchImages();
        await fetchTags();
      } else {
        const errorData = await response.json();
        alert(`删除失败: ${errorData.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('删除过程中发生网络错误。');
    } finally {
      setIsDeleting(null);
      setDeleteConfirmId(null);
    }
  };

  const handleEditClick = (img: GalleryImage) => {
    setEditingImage(img);
    setEditPrompt(img.prompt_original);
    setEditTags(JSON.parse(img.tags || '[]'));
    setEditNewTag('');
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingImage || !editPrompt) return;

    setUploading(true);
    try {
      const response = await fetch(`/api/images/${editingImage.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: editPrompt,
          tags: editTags
        })
      });

      if (response.ok) {
        setIsEditModalOpen(false);
        setEditingImage(null);
        setEditPrompt('');
        setEditTags([]);
        fetchImages();
        fetchTags();
      } else {
        const errorData = await response.json();
        alert(`Update failed: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Update failed:', error);
      alert('An unexpected error occurred during update.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 glass border-b border-black/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <ImageIcon size={24} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">AI 提示词画廊 <span className="text-[10px] text-black/20 font-normal">v2.0</span></h1>
          </div>

          <div className="flex-1 max-w-2xl w-full relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" size={18} />
            <input 
              type="text"
              placeholder="搜索提示词或标签..."
              className="w-full pl-12 pr-4 py-2.5 bg-black/5 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button 
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-medium transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Plus size={18} />
            <span>上传作品</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {/* Tags Filter */}
        <div className="flex items-center gap-3 mb-8 overflow-x-auto pb-2 no-scrollbar">
          <div className="flex items-center gap-2 text-black/40 mr-2">
            <Filter size={16} />
            <span className="text-sm font-medium uppercase tracking-wider">标签</span>
          </div>
          <button 
            onClick={() => setSelectedTag(null)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${!selectedTag ? 'bg-emerald-500 text-white' : 'bg-black/5 hover:bg-black/10'}`}
          >
            全部
          </button>
          {availableTags.map(tag => (
            <button 
              key={tag}
              onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${selectedTag === tag ? 'bg-emerald-500 text-white' : 'bg-black/5 hover:bg-black/10'}`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Gallery Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-emerald-500" size={40} />
            <p className="text-black/40 font-medium">正在加载您的杰作...</p>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-black/5 rounded-full flex items-center justify-center text-black/20 mb-4">
              <ImageIcon size={40} />
            </div>
            <h3 className="text-lg font-semibold">未找到图片</h3>
            <p className="text-black/40">尝试调整搜索或上传新作品！</p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
            {images.map((img) => (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                key={img.id}
                className="break-inside-avoid prompt-card bg-white rounded-lg overflow-hidden border border-black/5 flex flex-col shadow-sm group"
              >
                <div className="relative overflow-hidden cursor-pointer" onClick={() => setViewingImage(img)}>
                  <img 
                    src={img.image_data} 
                    alt={img.prompt_en} 
                    className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Hover Overlay with Maximize Icon */}
                  <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/30">
                      <Maximize2 size={20} />
                    </div>
                  </div>

                  {/* Action Buttons - Bottom Right, Hidden until hover */}
                  <div className="absolute bottom-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                    <button 
                      onClick={(e) => { e.stopPropagation(); copyToClipboard(img.prompt_original, img.id); }}
                      className={`p-2 rounded-lg transition-all backdrop-blur-md border ${
                        copiedId === img.id 
                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' 
                          : 'bg-white/80 text-black/60 border-white/50 hover:bg-white hover:text-emerald-600 shadow-sm'
                      }`}
                      title="Copy Prompt"
                    >
                      {copiedId === img.id ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleEditClick(img); }}
                      className="p-2 bg-white/80 text-black/60 border border-white/50 hover:bg-white hover:text-emerald-500 rounded-lg transition-all backdrop-blur-md shadow-sm"
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(img.id); }}
                      className={`flex items-center gap-1.5 p-2 rounded-lg transition-all backdrop-blur-md border ${
                        deleteConfirmId === img.id 
                          ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/30' 
                          : 'bg-white/80 text-black/60 border-white/50 hover:bg-white hover:text-red-500 shadow-sm'
                      }`}
                      title={deleteConfirmId === img.id ? "Confirm Delete" : "Delete"}
                      disabled={isDeleting === img.id}
                    >
                      {isDeleting === img.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : deleteConfirmId === img.id ? (
                        <span className="text-[10px] font-bold px-1">确认?</span>
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !uploading && setIsUploadModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-8 py-6 border-b border-black/5 flex items-center justify-between">
                <h2 className="text-xl font-bold">上传 AI 作品</h2>
                <button 
                  onClick={() => setIsUploadModalOpen(false)}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors"
                  disabled={uploading}
                >
                  <X size={20} />
                </button>
              </div>
 
              <form onSubmit={handleUpload} className="p-8 overflow-y-auto flex flex-col gap-6">
                {/* Image Dropzone */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`aspect-video rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden relative ${uploadImage ? 'border-emerald-500 bg-emerald-50/30' : 'border-black/10 hover:border-emerald-500/50 hover:bg-black/5'}`}
                >
                  {uploadImage ? (
                    <>
                      <img src={uploadImage} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                        <p className="text-white font-medium bg-black/40 px-4 py-2 rounded-full backdrop-blur-md">更换图片</p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-6">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Upload size={24} />
                      </div>
                      <p className="font-semibold text-black/80">点击上传图片</p>
                      <p className="text-sm text-black/40 mt-1">支持 PNG, JPG 或 WebP，最大 10MB</p>
                    </div>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageChange} 
                    className="hidden" 
                    accept="image/*"
                  />
                </div>
 
                {/* Prompt Input */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-black/40">AI 提示词</label>
                  <textarea 
                    value={uploadPrompt}
                    onChange={(e) => setUploadPrompt(e.target.value)}
                    placeholder="输入用于生成此图片的提示词..."
                    className="w-full p-4 bg-black/5 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all min-h-[100px] resize-none"
                    required
                  />
                </div>

                {/* Category Tagging Section */}
                <div className="flex flex-col gap-3 p-5 bg-emerald-50/50 rounded-[24px] border border-emerald-100">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <TagIcon size={16} />
                    <label className="text-xs font-bold uppercase tracking-widest">分类标签 (如：海报、主视觉、人物照片)</label>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {uploadTags.map(tag => (
                      <span key={tag} className="flex items-center gap-1 px-3 py-1.5 bg-white text-emerald-700 rounded-xl text-sm font-bold border border-emerald-200 shadow-sm">
                        {tag}
                        <button type="button" onClick={() => handleRemoveTag(tag)} className="p-0.5 hover:bg-emerald-100 rounded-md transition-colors">
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                      placeholder="输入分类名称并按回车..."
                      className="flex-1 px-4 py-2.5 bg-white border border-emerald-100 rounded-xl focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all text-sm"
                    />
                    <button 
                      type="button"
                      onClick={() => handleAddTag()}
                      className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-emerald-500/20"
                    >
                      添加
                    </button>
                  </div>

                  {availableTags.length > 0 && (
                    <div className="mt-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/60 mb-2">常用分类</p>
                      <div className="flex flex-wrap gap-2">
                        {availableTags.filter(t => !uploadTags.includes(t)).slice(0, 10).map(tag => (
                          <button 
                            key={tag}
                            type="button"
                            onClick={() => setUploadTags([...uploadTags, tag])}
                            className="px-2.5 py-1 bg-emerald-100/50 hover:bg-emerald-100 rounded-lg text-[10px] font-bold text-emerald-700 transition-all border border-emerald-100"
                          >
                            +{tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button 
                  type="submit"
                  disabled={uploading || !uploadImage || !uploadPrompt}
                  className="mt-4 w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-black/10 disabled:text-black/30 text-white rounded-2xl font-bold transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      <span>正在处理并翻译...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={20} />
                      <span>发布到画廊</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full Screen View Modal */}
      <AnimatePresence>
        {viewingImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingImage(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
            >
              {/* Header Info */}
              <div className="p-8 flex flex-col gap-6 overflow-y-auto">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-bold text-slate-900">AI 创意素材详情</h2>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span>来源:</span>
                        <span className="text-slate-600 font-medium">@Gallery_User</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>模型:</span>
                        <span className="text-slate-600 font-medium">Nano Banana 2</span>
                      </div>
                    </div>
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                    <Heart size={16} />
                    <span>收藏</span>
                  </button>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {JSON.parse(viewingImage.tags || '[]').map((tag: string) => (
                    <span key={tag} className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-xs font-bold uppercase tracking-wider">
                      {tag}
                    </span>
                  ))}
                  {JSON.parse(viewingImage.tags || '[]').length === 0 && (
                    <span className="text-xs text-slate-300 italic">暂无分类标签</span>
                  )}
                </div>

                {/* Example Image Section */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-blue-500 rounded-full" />
                    <h3 className="text-base font-bold text-slate-800">示例图片</h3>
                  </div>
                  <div className="rounded-2xl overflow-hidden bg-slate-50 border border-slate-100">
                    <img 
                      src={viewingImage.image_data} 
                      className="w-full h-auto max-h-[500px] object-contain mx-auto" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>

                {/* Prompt Section */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-purple-500 rounded-full" />
                    <h3 className="text-base font-bold text-slate-800">提示词</h3>
                  </div>
                  <div className="rounded-2xl border border-slate-100 overflow-hidden">
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ENGLISH</span>
                      <button 
                        onClick={() => copyToClipboard(viewingImage.prompt_original, viewingImage.id)}
                        className="text-[10px] font-bold text-blue-500 hover:text-blue-600 uppercase tracking-widest"
                      >
                        {copiedId === viewingImage.id ? '已复制' : '复制'}
                      </button>
                    </div>
                    <div className="p-6 bg-white">
                      <p className="text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
                        {viewingImage.prompt_original}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button 
                onClick={() => setViewingImage(null)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !uploading && setIsEditModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-8 py-6 border-b border-black/5 flex items-center justify-between">
                <h2 className="text-xl font-bold">编辑作品</h2>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors"
                  disabled={uploading}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpdate} className="p-8 overflow-y-auto flex flex-col gap-6">
                {/* Image Preview (Read-only) */}
                <div className="aspect-video rounded-2xl border border-black/10 overflow-hidden bg-black/5">
                  <img src={editingImage?.image_data} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                </div>

                {/* Prompt Input */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-black/40">AI 提示词</label>
                  <textarea 
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="更新提示词..."
                    className="w-full p-4 bg-black/5 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all min-h-[100px] resize-none"
                    required
                  />
                </div>

                {/* Category Tagging Section */}
                <div className="flex flex-col gap-3 p-5 bg-emerald-50/50 rounded-[24px] border border-emerald-100">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <TagIcon size={16} />
                    <label className="text-xs font-bold uppercase tracking-widest">分类标签 (如：海报、主视觉、人物照片)</label>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {editTags.map(tag => (
                      <span key={tag} className="flex items-center gap-1 px-3 py-1.5 bg-white text-emerald-700 rounded-xl text-sm font-bold border border-emerald-200 shadow-sm">
                        {tag}
                        <button type="button" onClick={() => handleRemoveTag(tag, true)} className="p-0.5 hover:bg-emerald-100 rounded-md transition-colors">
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={editNewTag}
                      onChange={(e) => setEditNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag(true))}
                      placeholder="输入分类名称并按回车..."
                      className="flex-1 px-4 py-2.5 bg-white border border-emerald-100 rounded-xl focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all text-sm"
                    />
                    <button 
                      type="button"
                      onClick={() => handleAddTag(true)}
                      className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-emerald-500/20"
                    >
                      添加
                    </button>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={uploading || !editPrompt}
                  className="mt-4 w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-black/10 disabled:text-black/30 text-white rounded-2xl font-bold transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      <span>正在更新...</span>
                    </>
                  ) : (
                    <>
                      <span>保存修改</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="py-8 border-t border-black/5 text-center">
        <p className="text-sm text-black/30 font-medium">AI 提示词画廊 &copy; 2024 • 由 Gemini 倾力打造</p>
      </footer>
    </div>
  );
}
