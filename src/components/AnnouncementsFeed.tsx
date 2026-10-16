import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Pin,
  Trash2,
  Plus,
  Search,
  ChevronDown,
  ChevronUp,
  Shield,
  Clock,
  Check,
  Building,
  Radio,
} from 'lucide-react';
import type { CustomPost, PostPriority } from '../types/permissionsAndPosts';
import type { AppUser, StaffUser } from '../types';

interface AnnouncementsFeedProps {
  currentUser?: AppUser | StaffUser | null;
  currentRole?: string;
  activeSiteId?: string;
  activeWard?: string;
  onOpenCreatePostModal?: () => void;
  canPublish?: boolean;
}

export const AnnouncementsFeed: React.FC<AnnouncementsFeedProps> = ({
  currentUser,
  currentRole = 'staff',
  activeSiteId,
  activeWard,
  onOpenCreatePostModal,
  canPublish = false,
}) => {
  const [posts, setPosts] = useState<CustomPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<'ALL' | 'CRITICAL' | 'PINNED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [acknowledgingIds, setAcknowledgingIds] = useState<Record<string, boolean>>({});

  const userRole = (currentRole || currentUser?.role || 'staff').toLowerCase();
  const isMasterAdmin = userRole === 'admin' || userRole === 'master_admin';
  const isManager = userRole === 'manager' || userRole === 'operations_manager';
  const currentUserId = String(currentUser?.id || (currentUser as any)?.staff_id || 'guest');

  // Fetch posts from backend or fallback to initial seeded notices
  const fetchPosts = async () => {
    try {
      const response = await fetch('/api/posts', {
        headers: {
          'x-user-role': userRole,
          'x-site-id': activeSiteId || '',
          'x-ward': activeWard || '',
          'x-user-id': currentUserId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.posts && Array.isArray(data.posts)) {
          setPosts(data.posts);
          return;
        }
      }
    } catch (err) {
      console.warn('[Announcements] Failed to fetch from backend, checking localStorage:', err);
    }

    // Local storage fallback
    try {
      const cached = localStorage.getItem('basu_custom_posts_cache_v2');
      if (cached) {
        setPosts(JSON.parse(cached));
      }
    } catch {}
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPosts().finally(() => setIsLoading(false));

    // Listen for custom dispatch events
    const handleAnnouncement = (e: any) => {
      if (e.detail?.post) {
        setPosts((prev) => {
          const exists = prev.some((p) => p.id === e.detail.post.id);
          if (exists) return prev;
          return [e.detail.post, ...prev];
        });
      }
    };

    window.addEventListener('announcement-published', handleAnnouncement);
    window.addEventListener('announcements-refresh', fetchPosts);

    return () => {
      window.removeEventListener('announcement-published', handleAnnouncement);
      window.removeEventListener('announcements-refresh', fetchPosts);
    };
  }, [userRole, activeSiteId, activeWard]);

  // Acknowledge Notice
  const handleAcknowledge = async (postId: string) => {
    setAcknowledgingIds((prev) => ({ ...prev, [postId]: true }));
    try {
      await fetch(`/api/posts/${encodeURIComponent(postId)}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
        },
        body: JSON.stringify({ userId: currentUserId }),
      });

      setPosts((prev) =>
        prev.map((p) => {
          if (p.id === postId) {
            const readBy = p.read_by || [];
            if (!readBy.includes(currentUserId)) {
              return { ...p, read_by: [...readBy, currentUserId] };
            }
          }
          return p;
        })
      );
    } catch (err) {
      console.error('Failed to acknowledge post:', err);
    } finally {
      setAcknowledgingIds((prev) => ({ ...prev, [postId]: false }));
    }
  };

  // Toggle Pin
  const handleTogglePin = async (postId: string) => {
    if (!isMasterAdmin && !isManager) return;
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/pin`, {
        method: 'PUT',
      });
      if (res.ok) {
        const data = await res.json();
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, pinned: data.pinned } : p))
        );
      }
    } catch (err) {
      console.error('Failed to pin post:', err);
    }
  };

  // Delete Notice
  const handleDeletePost = async (postId: string) => {
    if (!isMasterAdmin && !isManager) return;
    if (!confirm('Are you sure you want to delete this operational announcement?')) return;

    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
        headers: {
          'x-user-role': userRole,
        },
      });

      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      }
    } catch (err) {
      console.error('Failed to delete post:', err);
    }
  };

  // Filtered list
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (filterType === 'CRITICAL' && post.priority !== 'CRITICAL' && post.priority !== 'URGENT') {
        return false;
      }
      if (filterType === 'PINNED' && !post.pinned) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = post.title.toLowerCase().includes(q);
        const matchContent = post.content.toLowerCase().includes(q);
        const matchAuthor = (post.author_name || '').toLowerCase().includes(q);
        if (!matchTitle && !matchContent && !matchAuthor) return false;
      }
      return true;
    });
  }, [posts, filterType, searchQuery]);

  // Critical Alerts Count
  const criticalCount = posts.filter((p) => p.priority === 'CRITICAL').length;
  const unreadCount = posts.filter((p) => !p.read_by?.includes(currentUserId)).length;

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden mb-6 transition-all">
      {/* Top Banner Header */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-[#1E3A8A] to-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative p-2 rounded-xl bg-white/10 text-white flex items-center justify-center">
            <Radio className="h-4 w-4 animate-pulse text-amber-300" />
            {criticalCount > 0 && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-rose-500 animate-ping" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold tracking-tight">
                Operational Bulletins & Announcements Feed
              </h2>
              {unreadCount > 0 && (
                <span className="px-2 py-0.2 rounded-full text-3xs font-extrabold bg-amber-400 text-slate-950">
                  {unreadCount} New
                </span>
              )}
            </div>
            <p className="text-3xs text-blue-200 hidden sm:block">
              Hospital directives, emergency protocols, and shift coordination notices
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {canPublish && onOpenCreatePostModal && (
            <button
              type="button"
              id="btn-create-announcement"
              onClick={onOpenCreatePostModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 transition-colors cursor-pointer shadow-xs"
              title="Publish a new operational notice or emergency directive"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ Create Notice</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand feed' : 'Collapse feed'}
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Filter & Search Bar (Visible when expanded) */}
      {!isCollapsed && (
        <>
          <div className="px-5 py-2.5 bg-slate-50/80 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2.5 text-xs">
            {/* Quick Filters */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterType('ALL')}
                className={`px-3 py-1 rounded-lg text-2xs font-bold transition-colors cursor-pointer ${
                  filterType === 'ALL'
                    ? 'bg-[#1E3A8A] text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                All Notices ({posts.length})
              </button>

              <button
                type="button"
                onClick={() => setFilterType('CRITICAL')}
                className={`px-3 py-1 rounded-lg text-2xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                  filterType === 'CRITICAL'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
                }`}
              >
                <AlertTriangle className="h-3 w-3" />
                <span>Urgent / Critical</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterType('PINNED')}
                className={`px-3 py-1 rounded-lg text-2xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                  filterType === 'PINNED'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Pin className="h-3 w-3" />
                <span>Pinned</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bulletins..."
                className="pl-8 pr-3 py-1 rounded-lg border border-slate-200 text-2xs bg-white text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#1E3A8A] w-40 sm:w-52"
              />
            </div>
          </div>

          {/* Posts List */}
          <div className="p-4 sm:p-5 space-y-3.5 max-h-[460px] overflow-y-auto">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading notices feed...</div>
            ) : filteredPosts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 space-y-1">
                <CheckCircle2 className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-600">No announcements match current filter</p>
                <p className="text-3xs text-slate-400">All shifts are updated with latest directives.</p>
              </div>
            ) : (
              filteredPosts.map((post) => {
                const isRead = post.read_by?.includes(currentUserId);
                const isAcknowledging = acknowledgingIds[post.id];

                return (
                  <div
                    key={post.id}
                    className={`relative rounded-xl border transition-all ${
                      post.priority === 'CRITICAL'
                        ? 'bg-gradient-to-r from-rose-50/90 via-red-50/50 to-white border-rose-300 shadow-xs'
                        : post.priority === 'URGENT'
                        ? 'bg-gradient-to-r from-amber-50/90 via-yellow-50/40 to-white border-amber-300 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="p-4">
                      {/* Post Header Meta */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Priority Pill */}
                          {post.priority === 'CRITICAL' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-extrabold bg-rose-600 text-white tracking-wider animate-pulse">
                              <AlertCircle className="h-3 w-3" /> CRITICAL ALERT
                            </span>
                          )}
                          {post.priority === 'URGENT' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-extrabold bg-amber-500 text-white tracking-wider">
                              <AlertTriangle className="h-3 w-3" /> URGENT DIRECTIVE
                            </span>
                          )}
                          {post.priority === 'NORMAL' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-blue-100 text-[#1E3A8A]">
                              <CheckCircle2 className="h-2.5 w-2.5" /> NOTICE
                            </span>
                          )}

                          {post.pinned && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <Pin className="h-2.5 w-2.5" /> Pinned
                            </span>
                          )}

                          {/* Target Audience Badge */}
                          <span className="text-3xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Building className="h-2.5 w-2.5 text-slate-400" />
                            {post.target_audience_type === 'ALL_SITES'
                              ? 'All Sites'
                              : post.target_audience_type === 'SPECIFIC_SITE'
                              ? `Campus: ${post.target_site_name || post.target_site_id}`
                              : post.target_audience_type === 'SPECIFIC_WARD'
                              ? `Ward: ${post.target_ward}`
                              : `Role: ${post.target_role?.toUpperCase()}`}
                          </span>
                        </div>

                        {/* Top-right Controls */}
                        <div className="flex items-center gap-1.5 text-3xs text-slate-400 font-mono">
                          <Clock className="h-3 w-3" />
                          <span>
                            {new Date(post.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>

                          {(isMasterAdmin || isManager) && (
                            <div className="flex items-center gap-1 ml-2">
                              <button
                                type="button"
                                onClick={() => handleTogglePin(post.id)}
                                className={`p-1 rounded-md transition-colors cursor-pointer ${
                                  post.pinned ? 'text-amber-600 bg-amber-50' : 'text-slate-400 hover:text-slate-600'
                                }`}
                                title={post.pinned ? 'Unpin' : 'Pin to top'}
                              >
                                <Pin className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePost(post.id)}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Delete announcement"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Post Title */}
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-1.5">
                        {post.title}
                      </h3>

                      {/* Post Body */}
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line mb-3">
                        {post.content}
                      </p>

                      {/* Footer: Author Info & Acknowledge Button */}
                      <div className="pt-2.5 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-2xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Shield className="h-3 w-3 text-[#1E3A8A]" />
                          <span className="font-semibold text-slate-700">{post.author_name}</span>
                          <span className="text-3xs text-slate-400">({post.author_role})</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-3xs text-slate-400">
                            {post.read_by?.length || 0} Acknowledged
                          </span>

                          <button
                            type="button"
                            onClick={() => handleAcknowledge(post.id)}
                            disabled={isRead || isAcknowledging}
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-3xs font-bold transition-all cursor-pointer ${
                              isRead
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                                : 'bg-[#1E3A8A] text-white hover:bg-blue-900 shadow-2xs'
                            }`}
                          >
                            {isRead ? (
                              <>
                                <Check className="h-3 w-3" />
                                <span>Acknowledged</span>
                              </>
                            ) : (
                              <>
                                <span>{isAcknowledging ? 'Recording...' : 'Acknowledge Directive'}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};
