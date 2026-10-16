import React, { useState } from 'react';
import {
  X,
  Send,
  AlertTriangle,
  AlertCircle,
  Bell,
  CheckCircle2,
  Pin,
  Building,
  Users,
  Eye,
  Sparkles,
} from 'lucide-react';
import type {
  CustomPost,
  PostPriority,
  TargetAudienceType,
} from '../types/permissionsAndPosts';
import type { AppUser, StaffUser } from '../types';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: AppUser | StaffUser | null;
  availableSites?: Array<{ siteId: string; siteName: string }>;
  onPostCreated?: (post: CustomPost) => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  availableSites = [],
  onPostCreated,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<PostPriority>('NORMAL');
  const [targetAudienceType, setTargetAudienceType] = useState<TargetAudienceType>('ALL_SITES');
  const [targetSiteId, setTargetSiteId] = useState(availableSites[0]?.siteId || '');
  const [targetWard, setTargetWard] = useState('');
  const [targetRole, setTargetRole] = useState<'all' | 'operations_manager' | 'supervisor' | 'staff'>('all');
  const [pinned, setPinned] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const userRole = (currentUser?.role || '').toLowerCase();
  const isMasterAdmin = userRole === 'admin' || userRole === 'master_admin';
  const authorName =
    (currentUser as any)?.full_name ||
    currentUser?.name ||
    (isMasterAdmin ? 'Dr. P. Basu (Master Admin)' : 'Operations Manager');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!title.trim()) {
      setErrorMessage('Please enter an announcement title.');
      return;
    }
    if (!content.trim()) {
      setErrorMessage('Please write the announcement content body.');
      return;
    }

    setIsSubmitting(true);

    const targetSiteObj = availableSites.find((s) => s.siteId === targetSiteId);

    const payload: Partial<CustomPost> = {
      title: title.trim(),
      content: content.trim(),
      priority,
      target_audience_type: targetAudienceType,
      target_site_id: targetAudienceType === 'SPECIFIC_SITE' ? targetSiteId : undefined,
      target_site_name: targetAudienceType === 'SPECIFIC_SITE' ? targetSiteObj?.siteName : undefined,
      target_ward: targetAudienceType === 'SPECIFIC_WARD' ? targetWard.trim() : undefined,
      target_role: targetAudienceType === 'SPECIFIC_ROLE' ? targetRole : 'all',
      pinned,
      author_id: currentUser?.id || (currentUser as any)?.staff_id || 'admin',
      author_name: authorName,
      author_role: isMasterAdmin ? 'MASTER_ADMIN' : 'OPERATIONS_MANAGER',
    };

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': userRole || 'admin',
          'x-user-id': String(currentUser?.id || 'admin'),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to broadcast announcement');
      }

      const data = await response.json();
      const createdPost: CustomPost = data.post || {
        ...payload,
        id: `post-${Date.now()}`,
        created_at: new Date().toISOString(),
        read_by: [],
      };

      // Store in local storage cache for offline resiliency
      try {
        const localKey = 'basu_custom_posts_cache_v2';
        const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
        existing.unshift(createdPost);
        localStorage.setItem(localKey, JSON.stringify(existing));
      } catch {}

      // Dispatch real-time custom event
      window.dispatchEvent(new CustomEvent('announcement-published', { detail: { post: createdPost } }));

      if (onPostCreated) {
        onPostCreated(createdPost);
      }

      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error publishing notice. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#1E3A8A] to-blue-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 text-white">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>Create Operational Notice & Alert</span>
                <span className="text-3xs uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 font-mono">
                  {isMasterAdmin ? 'Master Admin' : 'Operations Desk'}
                </span>
              </h2>
              <p className="text-2xs text-blue-100">
                Broadcast official hospital announcements, safety directives & shift alerts
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Controls: Edit Form vs Live Preview */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2">
          <button
            type="button"
            onClick={() => setIsPreview(false)}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              !isPreview
                ? 'border-[#1E3A8A] text-[#1E3A8A] bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Compose Notice</span>
          </button>
          <button
            type="button"
            onClick={() => setIsPreview(true)}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              isPreview
                ? 'border-[#1E3A8A] text-[#1E3A8A] bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Live Card Preview</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {!isPreview ? (
            <form id="create-post-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Priority Selector */}
              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Priority & Urgency Level *
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPriority('NORMAL')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      priority === 'NORMAL'
                        ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-400/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-blue-100 text-blue-800">
                        <CheckCircle2 className="h-3 w-3" /> NORMAL
                      </span>
                    </div>
                    <p className="text-3xs text-slate-500">General notice, guidelines or operational memo</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPriority('URGENT')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      priority === 'URGENT'
                        ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-400/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-amber-100 text-amber-800">
                        <AlertTriangle className="h-3 w-3" /> URGENT
                      </span>
                    </div>
                    <p className="text-3xs text-slate-500">Requires review and adherence within 12h</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPriority('CRITICAL')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      priority === 'CRITICAL'
                        ? 'bg-rose-50/80 border-rose-500 ring-2 ring-rose-400/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-rose-600 text-white animate-pulse">
                        <AlertCircle className="h-3 w-3" /> CRITICAL
                      </span>
                    </div>
                    <p className="text-3xs text-slate-500">Code Blue, fire safety or emergency directive</p>
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Post Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Immediate Sanitization Protocol for Post-Op Ward"
                  maxLength={140}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A] focus:border-transparent font-medium"
                  required
                />
                <div className="flex justify-between text-3xs text-slate-400 mt-1">
                  <span>Be clear, concise, and professional</span>
                  <span>{title.length}/140</span>
                </div>
              </div>

              {/* Target Audience */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <Building className="h-4 w-4 text-[#1E3A8A]" />
                  <span>Target Audience & Jurisdiction Scope</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'ALL_SITES', label: 'All Sites (Global)' },
                    { id: 'SPECIFIC_SITE', label: 'Specific Campus' },
                    { id: 'SPECIFIC_WARD', label: 'Specific Ward' },
                    { id: 'SPECIFIC_ROLE', label: 'Role-Specific' },
                  ].map((aud) => (
                    <button
                      key={aud.id}
                      type="button"
                      onClick={() => setTargetAudienceType(aud.id as TargetAudienceType)}
                      className={`px-2.5 py-2 rounded-lg text-2xs font-bold border transition-colors cursor-pointer text-center ${
                        targetAudienceType === aud.id
                          ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {aud.label}
                    </button>
                  ))}
                </div>

                {/* Conditional Fields based on Target Audience */}
                {targetAudienceType === 'SPECIFIC_SITE' && (
                  <div>
                    <label className="block text-3xs font-bold uppercase text-slate-600 mb-1">
                      Select Target Hospital Site / Campus
                    </label>
                    <select
                      value={targetSiteId}
                      onChange={(e) => setTargetSiteId(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A]"
                    >
                      {availableSites.map((site) => (
                        <option key={site.siteId} value={site.siteId}>
                          {site.siteName} ({site.siteId})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {targetAudienceType === 'SPECIFIC_WARD' && (
                  <div>
                    <label className="block text-3xs font-bold uppercase text-slate-600 mb-1">
                      Designated Ward / Department / Area
                    </label>
                    <input
                      type="text"
                      value={targetWard}
                      onChange={(e) => setTargetWard(e.target.value)}
                      placeholder="e.g. ICU, Emergency, OPD Floor 3, OT Block"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A]"
                    />
                  </div>
                )}

                {targetAudienceType === 'SPECIFIC_ROLE' && (
                  <div>
                    <label className="block text-3xs font-bold uppercase text-slate-600 mb-1">
                      Recipient Role Group
                    </label>
                    <select
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value as any)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A]"
                    >
                      <option value="all">All Roles (Admins, Managers, Supervisors, Staff)</option>
                      <option value="supervisor">Ward Supervisors Only</option>
                      <option value="staff">Floor Housekeeping Staff Only</option>
                      <option value="operations_manager">Operations Managers Only</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Content / Body */}
              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Notice Details / Content Body *
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  placeholder="Provide complete operational guidance, instructions, safety precautions or steps required from staff..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A] focus:border-transparent font-sans"
                  required
                />
              </div>

              {/* Options: Pin to Top */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pin-post-checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="h-4 w-4 rounded-md border-slate-300 text-[#1E3A8A] focus:ring-[#1E3A8A] cursor-pointer"
                />
                <label htmlFor="pin-post-checkbox" className="text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-1.5">
                  <Pin className="h-3.5 w-3.5 text-amber-600" />
                  <span>Pin this announcement to top of dashboard feed</span>
                </label>
              </div>
            </form>
          ) : (
            /* Live Card Preview */
            <div className="space-y-4">
              <div className="text-2xs font-bold text-slate-500 uppercase tracking-wider">
                How this will appear on the User Dashboard:
              </div>

              <div
                className={`p-4 rounded-2xl border transition-all ${
                  priority === 'CRITICAL'
                    ? 'bg-gradient-to-r from-rose-50 via-red-50 to-rose-100 border-rose-300 shadow-md'
                    : priority === 'URGENT'
                    ? 'bg-gradient-to-r from-amber-50 via-amber-50/60 to-amber-100 border-amber-300 shadow-sm'
                    : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {priority === 'CRITICAL' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-extrabold bg-rose-600 text-white animate-pulse">
                        <AlertCircle className="h-3 w-3" /> CRITICAL DIRECTIVE
                      </span>
                    )}
                    {priority === 'URGENT' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-extrabold bg-amber-500 text-white">
                        <AlertTriangle className="h-3 w-3" /> URGENT NOTICE
                      </span>
                    )}
                    {priority === 'NORMAL' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-blue-100 text-[#1E3A8A]">
                        <CheckCircle2 className="h-3 w-3" /> NOTICE
                      </span>
                    )}
                    {pinned && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        <Pin className="h-2.5 w-2.5" /> Pinned
                      </span>
                    )}
                    <span className="text-3xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      Audience:{' '}
                      {targetAudienceType === 'ALL_SITES'
                        ? 'All Sites'
                        : targetAudienceType === 'SPECIFIC_SITE'
                        ? `Campus: ${targetSiteId}`
                        : targetAudienceType === 'SPECIFIC_WARD'
                        ? `Ward: ${targetWard || 'All'}`
                        : `Role: ${targetRole}`}
                    </span>
                  </div>
                  <span className="text-3xs text-slate-400 font-mono">Just now</span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 mb-1.5">
                  {title || 'Announcement Title Preview'}
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                  {content || 'Detailed announcement content body will be displayed here for all staff.'}
                </p>

                <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between text-2xs text-slate-500">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Users className="h-3 w-3 text-slate-400" />
                    <span>Published by {authorName}</span>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold text-3xs cursor-default"
                  >
                    Acknowledge Notice (0)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            form="create-post-form"
            disabled={isSubmitting || !title.trim() || !content.trim()}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#1E3A8A] hover:bg-blue-900 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{isSubmitting ? 'Broadcasting...' : 'Publish & Broadcast Notice'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
