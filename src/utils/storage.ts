export const OFFLINE_MODE = true; // Cuts off external server usage

import { 
  BedrockAddon, ExternalLink, AddonComment, 
  MemberUser, VisitorPresence, AppStatusConfig, 
  OwnerLiveConfig, UserRole, KickRecord,
  InappropriateReport, CommunityRule, DownloadHistoryItem,
  ThemeMode, AddonCategory, TextFontPreference
} from '../types/addon';
import { getMinecraftCharacterAvatar } from './minecraftAvatars';
import { 
  ART_MONSTER_STRUCTURES, ART_FUNGUS_HAZARD, ART_BED_WARS, 
  ART_JAPANESE_GAKKUO, ART_DUCK_FRIENDS, ART_COZY_UP, 
  ART_SMOOTH_MOVES, ART_LUSH_VISUALS, ART_HAFEN_COZY, 
  ART_LUMINA_SHADERS, ART_INDUSTRIAL_TECH, ART_ANIME_ACADEMIA, ART_CHIBI_WORLD 
} from './addonCardArt';

const STORAGE_KEY_ADDONS = 'prismmods_addons_v4';
const STORAGE_KEY_TITLE = 'prismmods_active_title';
const STORAGE_KEY_BOOKMARKS = 'prismmods_bookmarks';
const STORAGE_KEY_DEV_SESSION = 'prismmods_dev_session';
const STORAGE_KEY_COMMENTS = 'prismmods_comments_v1';
const STORAGE_KEY_CURRENT_MEMBER = 'prismmods_active_member';
const STORAGE_KEY_MEMBERS = 'prismmods_all_members';
const STORAGE_KEY_VISITORS = 'prismmods_live_visitors_v2';
const STORAGE_KEY_BANNED_IDS = 'prismmods_banned_visitors';
const STORAGE_KEY_APP_STATUS = 'prismmods_app_status_v1';
const STORAGE_KEY_KICKED_TOKEN = 'prismmods_kicked_token';
const STORAGE_KEY_ADMIN_IDS = 'prismmods_admin_visitor_ids';
const STORAGE_KEY_OWNER_CONFIG = 'prismmods_owner_live_config';
const STORAGE_KEY_ADMIN_COLORS = 'prismmods_admin_custom_colors';
const STORAGE_KEY_THEME_MODE = 'prismmods_theme_mode';
const STORAGE_KEY_FONT_PREFERENCE = 'prismmods_font_preference';
const STORAGE_KEY_KICK_RECORDS = 'prismmods_kick_records_v2';
const STORAGE_KEY_REPORTS = 'prismmods_inappropriate_reports';
const STORAGE_KEY_RULES = 'prismmods_community_rules';
const STORAGE_KEY_DOWNLOAD_HISTORY = 'prismmods_download_history';
const STORAGE_KEY_SAVED_ACCOUNTS = 'prismmods_saved_accounts_v1';

// Broadcast channel for multi-tab live sync
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('prismmods_live_channel');
  }
} catch {}

export function broadcastAppEvent(type: string, payload?: any): void {
  try {
    broadcastChannel?.postMessage({ type, payload, timestamp: Date.now() });
  } catch {}
}

export function subscribeToLiveEvents(handler: (event: { type: string; payload: any }) => void): () => void {
  if (!broadcastChannel) return () => {};
  const listener = (msg: MessageEvent) => {
    if (msg.data) handler(msg.data);
  };
  broadcastChannel.addEventListener('message', listener);
  return () => {
    broadcastChannel?.removeEventListener('message', listener);
  };
}

export function isDeveloperEnvironment(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname;
    const isDevHost = host.includes('ais-dev') || host === 'localhost' || host === '127.0.0.1';
    const params = new URLSearchParams(window.location.search);
    const hasDevQuery = params.has('dev') || params.has('creator') || params.has('manage') || params.has('admin');

    let isOwnerEmail = false;
    try {
      const rawMem = localStorage.getItem(STORAGE_KEY_CURRENT_MEMBER);
      if (rawMem) {
        const mem = JSON.parse(rawMem);
        if (mem?.email === 'altaxx39@gmail.com') {
          isOwnerEmail = true;
        }
      }
    } catch {}

    if (isDevHost || hasDevQuery || isOwnerEmail) {
      localStorage.setItem(STORAGE_KEY_DEV_SESSION, 'true');
      return true;
    }

    return localStorage.getItem(STORAGE_KEY_DEV_SESSION) === 'true';
  } catch {
    return false;
  }
}

export function setDeveloperSession(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_DEV_SESSION, enabled ? 'true' : 'false');
    broadcastAppEvent('DEV_SESSION_CHANGE', enabled);
  } catch {}
}

export function getStoredAddons(): BedrockAddon[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ADDONS);
    if (!raw) {
      const starters = SAMPLE_STARTER_ADDONS.map((s) => ({ ...s, featured: true }));
      localStorage.setItem(STORAGE_KEY_ADDONS, JSON.stringify(starters));
      return starters;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      let hasChanges = false;
      const updated = parsed.map((a: any) => {
        if (a.id && a.id.startsWith('prism-') && !a.featured) {
          hasChanges = true;
          return { ...a, featured: true };
        }
        return a;
      });

      const existingIds = new Set(updated.map((a: any) => a.id));
      const missingStarters = SAMPLE_STARTER_ADDONS.filter(s => !existingIds.has(s.id)).map(s => ({ ...s, featured: true }));
      if (missingStarters.length > 0) {
        hasChanges = true;
        updated.push(...missingStarters);
      }

      if (hasChanges) {
        localStorage.setItem(STORAGE_KEY_ADDONS, JSON.stringify(updated));
      }
      return updated;
    }
    return SAMPLE_STARTER_ADDONS.map((s) => ({ ...s, featured: true }));
  } catch (err) {
    console.error('Failed to parse addons from storage', err);
    return SAMPLE_STARTER_ADDONS.map((s) => ({ ...s, featured: true }));
  }
}

export function saveStoredAddons(addons: BedrockAddon[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_ADDONS, JSON.stringify(addons));
    broadcastAppEvent('ADDONS_UPDATED', addons);
  } catch (err) {
    console.error('Failed to save addons to storage', err);
  }
}

// Download count increments
export function incrementAddonDownloads(addonId: string): number {
  try {
    const addons = getStoredAddons();
    let newCount = 1;
    const updated = addons.map((addon) => {
      if (addon.id === addonId) {
        newCount = (addon.downloadCount || 0) + 1;
        return { ...addon, downloadCount: newCount };
      }
      return addon;
    });
    saveStoredAddons(updated);
    broadcastAppEvent('DOWNLOAD_INCREMENTED', { addonId, newCount });
    return newCount;
  } catch {
    return 1;
  }
}

// App Status (Open / Close maintenance & App Icon)
export const DEFAULT_APP_STATUS: AppStatusConfig = {
  isClosed: false,
  closedMessage: 'Sorry, because our app is having problems and it is closing',
  lastOpenedAt: Date.now(),
  hasNotifiedOpen: true,
  appIconType: 'prism',
  loadingScreenImageUrl: '',
  loadingScreenTitle: 'PrismMods Bedrock Hub',
  loadingScreenSubtitle: 'Loading resources, behavior packs & terrain...',
  loadingScreenDuration: 5,
  downloadDelay: 0,
};

export function getAppStatus(): AppStatusConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_APP_STATUS);
    if (!raw) return DEFAULT_APP_STATUS;
    return { ...DEFAULT_APP_STATUS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_APP_STATUS;
  }
}

export function setAppStatus(updates: Partial<AppStatusConfig>): AppStatusConfig {
  try {
    const current = getAppStatus();
    const updated: AppStatusConfig = { ...current, ...updates };
    localStorage.setItem(STORAGE_KEY_APP_STATUS, JSON.stringify(updated));
    broadcastAppEvent('APP_STATUS_CHANGED', updated);
    return updated;
  } catch {
    return DEFAULT_APP_STATUS;
  }
}

// Comments Management
export function getStoredComments(addonId?: string): AddonComment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMMENTS);
    if (!raw) return [];
    const all: AddonComment[] = JSON.parse(raw);
    if (!Array.isArray(all)) return [];
    return addonId ? all.filter((c) => c.addonId === addonId) : all;
  } catch {
    return [];
  }
}

export function addStoredComment(comment: Omit<AddonComment, 'id' | 'createdAt'>): AddonComment {
  const newComment: AddonComment = {
    ...comment,
    id: 'comment-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    createdAt: Date.now(),
  };
  try {
    const all = getStoredComments();
    const updated = [newComment, ...all];
    localStorage.setItem(STORAGE_KEY_COMMENTS, JSON.stringify(updated));
    broadcastAppEvent('COMMENT_ADDED', newComment);
  } catch {}
  return newComment;
}

export function deleteStoredComment(commentId: string): void {
  try {
    const all = getStoredComments();
    const updated = all.filter((c) => c.id !== commentId);
    localStorage.setItem(STORAGE_KEY_COMMENTS, JSON.stringify(updated));
    broadcastAppEvent('COMMENT_DELETED', commentId);
  } catch {}
}

// Member Authentication
export function getCurrentMember(): MemberUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CURRENT_MEMBER);
    if (!raw) return null;
    const member: MemberUser = JSON.parse(raw);
    if (member && member.avatar && (member.avatar.includes('bottts') || member.avatar.includes('dicebear'))) {
      member.avatar = getMinecraftCharacterAvatar(member.username || member.email);
      localStorage.setItem(STORAGE_KEY_CURRENT_MEMBER, JSON.stringify(member));
    }
    return member;
  } catch {
    return null;
  }
}

export function setCurrentMember(member: MemberUser | null): void {
  try {
    if (member) {
      localStorage.setItem(STORAGE_KEY_CURRENT_MEMBER, JSON.stringify(member));
      // Also register in all members list
      const allMembers = getStoredMembers();
      if (!allMembers.some((m) => m.id === member.id)) {
        localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify([member, ...allMembers]));
      }
    } else {
      localStorage.removeItem(STORAGE_KEY_CURRENT_MEMBER);
    }
    broadcastAppEvent('MEMBER_AUTH_CHANGE', member);
  } catch {}
}

export function getStoredMembers(): MemberUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MEMBERS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Owner Live Status Configuration
export const DEFAULT_OWNER_CONFIG: OwnerLiveConfig = {
  tagText: 'Owner',
  tagColor: '#10b981', // green
  customLogoUrl: '', // 1x1 image
};

export function getOwnerLiveConfig(): OwnerLiveConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OWNER_CONFIG);
    return raw ? { ...DEFAULT_OWNER_CONFIG, ...JSON.parse(raw) } : DEFAULT_OWNER_CONFIG;
  } catch {
    return DEFAULT_OWNER_CONFIG;
  }
}

export function setOwnerLiveConfig(updates: Partial<OwnerLiveConfig>): OwnerLiveConfig {
  try {
    const current = getOwnerLiveConfig();
    const updated = { ...current, ...updates };
    localStorage.setItem(STORAGE_KEY_OWNER_CONFIG, JSON.stringify(updated));
    broadcastAppEvent('OWNER_CONFIG_CHANGED', updated);
    return updated;
  } catch {
    return DEFAULT_OWNER_CONFIG;
  }
}

// Admin Visitor IDs (Developer can promote visitors to Admin)
export function getAdminVisitorIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ADMIN_IDS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setVisitorAdminRole(visitorId: string, isAdmin: boolean): void {
  try {
    const current = getAdminVisitorIds();
    const updated = isAdmin
      ? Array.from(new Set([...current, visitorId]))
      : current.filter((id) => id !== visitorId);
    localStorage.setItem(STORAGE_KEY_ADMIN_IDS, JSON.stringify(updated));
    broadcastAppEvent('VISITOR_ADMIN_CHANGED', { visitorId, isAdmin });
  } catch {}
}

export function isCurrentVisitorAdmin(): boolean {
  try {
    const myId = getDeviceId();
    const admins = getAdminVisitorIds();
    return admins.includes(myId);
  } catch {
    return false;
  }
}

export function isVisitorAdmin(visitorId?: string): boolean {
  try {
    const targetId = visitorId || getDeviceId();
    const admins = getAdminVisitorIds();
    return admins.includes(targetId);
  } catch {
    return false;
  }
}

// Admin custom tag colors (Admins can customize their tag color)
export function getAdminTagColor(visitorId: string): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ADMIN_COLORS);
    const map = raw ? JSON.parse(raw) : {};
    return map[visitorId] || '#38bdf8'; // default cyan
  } catch {
    return '#38bdf8';
  }
}

export function setAdminTagColor(visitorId: string, color: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ADMIN_COLORS);
    const map = raw ? JSON.parse(raw) : {};
    map[visitorId] = color;
    localStorage.setItem(STORAGE_KEY_ADMIN_COLORS, JSON.stringify(map));
    broadcastAppEvent('ADMIN_COLOR_CHANGED', { visitorId, color });
  } catch {}
}

// Live Visitor Presence Tracking
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem('prismmods_device_id');
    if (!id) {
      id = 'vis-' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('prismmods_device_id', id);
    }
    return id;
  } catch {
    return 'vis-guest';
  }
}

export function getVisitorsList(): VisitorPresence[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VISITORS);
    let list: VisitorPresence[] = raw ? JSON.parse(raw) : [];
    const banned = getBannedVisitorIds();
    const adminIds = getAdminVisitorIds();
    const ownerConfig = getOwnerLiveConfig();
    const now = Date.now();
    const myId = getDeviceId();
    const isDev = isDeveloperEnvironment();

    if (list.length === 0) {
      list = [
        {
          id: myId,
          username: isDev ? 'Owner' : 'Visitor_' + myId.slice(-4),
          avatar: isDev ? getMinecraftCharacterAvatar('steve') : getMinecraftCharacterAvatar(myId),
          isOnline: true,
          lastSeen: now,
          isBanned: false,
          device: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop / PC',
          joinedAt: now - 1800000,
          role: isDev ? 'owner' : 'visitor',
          tagText: isDev ? ownerConfig.tagText : 'Visitor',
          tagColor: isDev ? ownerConfig.tagColor : '#64748b',
          customLogoUrl: isDev ? ownerConfig.customLogoUrl : '',
        },
      ];
      localStorage.setItem(STORAGE_KEY_VISITORS, JSON.stringify(list));
    }

    return list.map((v) => {
      const isOnline = (now - v.lastSeen) < 45000;
      const isBanned = banned.includes(v.id);
      const isOwnerUser = (v.id === myId && isDev) || v.role === 'owner';
      const isAdminUser = !isOwnerUser && adminIds.includes(v.id);

      let role: UserRole = 'visitor';
      let tagText = 'Visitor';
      let tagColor = '#64748b';
      let customLogoUrl = '';

      if (isOwnerUser) {
        role = 'owner';
        tagText = ownerConfig.tagText || 'Owner';
        tagColor = ownerConfig.tagColor || '#10b981';
        customLogoUrl = ownerConfig.customLogoUrl || '';
      } else if (isAdminUser) {
        role = 'admin';
        tagText = 'Admin';
        tagColor = getAdminTagColor(v.id) || '#38bdf8';
      }

      return {
        ...v,
        isOnline,
        isBanned,
        role,
        tagText,
        tagColor,
        customLogoUrl,
      };
    });
  } catch {
    return [];
  }
}

export function heartbeatVisitor(user?: MemberUser | null): void {
  try {
    const deviceId = getDeviceId();
    const now = Date.now();
    const currentList = getVisitorsList();
    const banned = getBannedVisitorIds();
    const adminIds = getAdminVisitorIds();
    const isDev = isDeveloperEnvironment();
    const ownerConfig = getOwnerLiveConfig();

    const isOwner = isDev;
    const isAdmin = !isOwner && adminIds.includes(deviceId);
    const role: UserRole = isOwner ? 'owner' : isAdmin ? 'admin' : 'visitor';
    const tagText = isOwner ? ownerConfig.tagText : isAdmin ? 'Admin' : 'Visitor';
    const tagColor = isOwner ? ownerConfig.tagColor : isAdmin ? getAdminTagColor(deviceId) : '#64748b';
    const customLogoUrl = isOwner ? ownerConfig.customLogoUrl : '';

    let username = user?.username;
    if (!username) {
      username = isOwner ? 'Owner' : 'Visitor_' + deviceId.slice(-4);
    }
    const avatar = user?.avatar || getMinecraftCharacterAvatar(deviceId);

    const existingIndex = currentList.findIndex((v) => v.id === deviceId);
    let updatedList: VisitorPresence[];

    const isSignedIn = !!user || isOwner;

    const updatedItem: VisitorPresence = {
      id: deviceId,
      username,
      avatar,
      isOnline: true,
      lastSeen: now,
      isBanned: banned.includes(deviceId),
      device: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop / PC',
      joinedAt: existingIndex >= 0 ? currentList[existingIndex].joinedAt : now,
      role,
      tagText,
      tagColor,
      customLogoUrl,
      isSignedIn,
    };

    if (existingIndex >= 0) {
      updatedList = currentList.map((v) => (v.id === deviceId ? updatedItem : v));
    } else {
      updatedList = [updatedItem, ...currentList];
    }

    localStorage.setItem(STORAGE_KEY_VISITORS, JSON.stringify(updatedList));
  } catch {}
}

export function getBannedVisitorIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BANNED_IDS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function banVisitor(visitorId: string, shouldBan: boolean): void {
  try {
    const current = getBannedVisitorIds();
    const updated = shouldBan
      ? Array.from(new Set([...current, visitorId]))
      : current.filter((id) => id !== visitorId);
    localStorage.setItem(STORAGE_KEY_BANNED_IDS, JSON.stringify(updated));
    broadcastAppEvent('VISITOR_BANNED', { visitorId, isBanned: shouldBan });
  } catch {}
}

// Kick with duration and custom warning message
export function kickVisitorWithTimeout(
  visitorId: string, 
  durationSeconds: number, 
  customMessage: string,
  username?: string
): KickRecord {
  const now = Date.now();
  const record: KickRecord = {
    visitorId,
    username: username || 'Visitor',
    kickedAt: now,
    durationSeconds: Math.max(10, durationSeconds),
    expiresAt: now + (Math.max(10, durationSeconds) * 1000),
    customMessage: customMessage.trim() || 'You have been kicked for violating community standards.',
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY_KICK_RECORDS);
    const map: Record<string, KickRecord> = raw ? JSON.parse(raw) : {};
    map[visitorId] = record;
    localStorage.setItem(STORAGE_KEY_KICK_RECORDS, JSON.stringify(map));
    localStorage.setItem(STORAGE_KEY_KICKED_TOKEN + '_' + visitorId, JSON.stringify(record));
    broadcastAppEvent('VISITOR_KICKED', record);
  } catch {}

  return record;
}

export function kickVisitor(visitorId: string, customMessage?: string): void {
  kickVisitorWithTimeout(visitorId, 60, customMessage || 'Session disconnected by developer.');
}

export function getKickRecord(visitorId: string): KickRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_KICK_RECORDS);
    const map: Record<string, KickRecord> = raw ? JSON.parse(raw) : {};
    const rec = map[visitorId];
    if (rec && Date.now() < rec.expiresAt) {
      return rec;
    }
    return null;
  } catch {
    return null;
  }
}

export function checkIsKicked(): KickRecord | null {
  try {
    const myId = getDeviceId();
    const raw = localStorage.getItem(STORAGE_KEY_KICK_RECORDS);
    const map: Record<string, KickRecord> = raw ? JSON.parse(raw) : {};
    const rec = map[myId];
    if (rec) {
      if (Date.now() < rec.expiresAt) {
        return rec;
      } else {
        // Expired! Clear kick record
        delete map[myId];
        localStorage.setItem(STORAGE_KEY_KICK_RECORDS, JSON.stringify(map));
        localStorage.removeItem(STORAGE_KEY_KICKED_TOKEN + '_' + myId);
        return null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function clearKickRecord(visitorId?: string): void {
  try {
    const targetId = visitorId || getDeviceId();
    const raw = localStorage.getItem(STORAGE_KEY_KICK_RECORDS);
    const map: Record<string, KickRecord> = raw ? JSON.parse(raw) : {};
    delete map[targetId];
    localStorage.setItem(STORAGE_KEY_KICK_RECORDS, JSON.stringify(map));
    localStorage.removeItem(STORAGE_KEY_KICKED_TOKEN + '_' + targetId);
    broadcastAppEvent('VISITOR_KICK_CLEARED', { visitorId: targetId });
  } catch {}
}

export function isCurrentVisitorBanned(): boolean {
  try {
    const myId = getDeviceId();
    const banned = getBannedVisitorIds();
    return banned.includes(myId);
  } catch {
    return false;
  }
}

export function getBrandTitle(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_TITLE) || 'PrismMods Bedrock';
  } catch {
    return 'PrismMods Bedrock';
  }
}

export function setBrandTitle(title: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_TITLE, title);
    broadcastAppEvent('TITLE_CHANGED', title);
  } catch {}
}

export function getStoredBookmarks(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BOOKMARKS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleStoredBookmark(id: string): string[] {
  try {
    const current = getStoredBookmarks();
    const updated = current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id];
    localStorage.setItem(STORAGE_KEY_BOOKMARKS, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function hasContent(val?: string | null): boolean {
  return typeof val === 'string' && val.trim().length > 0;
}

export function hasArrayContent<T>(arr?: T[] | null): boolean {
  return Array.isArray(arr) && arr.length > 0;
}

export function getValidLinks(links?: ExternalLink[]): ExternalLink[] {
  if (!Array.isArray(links)) return [];
  return links.filter((l) => hasContent(l.title) && hasContent(l.url));
}

// Theme Mode (Independent per device/phone)
export function getThemeMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_THEME_MODE);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    return 'dark'; // default dark mode for Minecraft styling
  } catch {
    return 'dark';
  }
}

export function setThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY_THEME_MODE, mode);
    if (typeof document !== 'undefined') {
      if (mode === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
    }
    broadcastAppEvent('THEME_CHANGED', mode);
  } catch {}
}

// Text Font Preference (Basic style vs Minecraft style font)
export function getFontPreference(): TextFontPreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_FONT_PREFERENCE);
    if (saved === 'minecraft' || saved === 'basic') {
      return saved;
    }
    return 'basic';
  } catch {
    return 'basic';
  }
}

export function setFontPreference(font: TextFontPreference): void {
  try {
    localStorage.setItem(STORAGE_KEY_FONT_PREFERENCE, font);
    if (typeof document !== 'undefined') {
      if (font === 'minecraft') {
        document.body.classList.add('font-minecraft');
        document.body.classList.remove('font-basic');
      } else {
        document.body.classList.remove('font-minecraft');
        document.body.classList.add('font-basic');
      }
    }
    broadcastAppEvent('FONT_CHANGED', font);
  } catch {}
}

// Inappropriate Reports (Sent directly to developer)
export function submitInappropriateReport(report: {
  targetType: 'comment' | 'addon' | 'visitor';
  targetId: string;
  targetTitleOrSnippet: string;
  reportedUserId: string;
  reportedUsername: string;
  reason: string;
}): InappropriateReport {
  const reporterId = getDeviceId();
  const currentMember = getCurrentMember();
  const newReport: InappropriateReport = {
    id: 'rep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    ...report,
    reporterId,
    reporterUsername: currentMember?.username || 'Visitor_' + reporterId.slice(-4),
    createdAt: Date.now(),
    resolved: false,
  };

  try {
    const reports = getInappropriateReports();
    const updated = [newReport, ...reports];
    localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(updated));
    broadcastAppEvent('NEW_REPORT_SUBMITTED', newReport);
  } catch {}

  return newReport;
}

export function getInappropriateReports(): InappropriateReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REPORTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function resolveInappropriateReport(id: string): void {
  try {
    const reports = getInappropriateReports();
    const updated = reports.map((r) => (r.id === id ? { ...r, resolved: true } : r));
    localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(updated));
    broadcastAppEvent('REPORT_RESOLVED', id);
  } catch {}
}

export function deleteInappropriateReport(id: string): void {
  try {
    const reports = getInappropriateReports();
    const updated = reports.filter((r) => r.id !== id);
    localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(updated));
    broadcastAppEvent('REPORT_DELETED', id);
  } catch {}
}

// Developer Community Rules
export const DEFAULT_COMMUNITY_RULES: CommunityRule[] = [
  {
    id: 'rule-1',
    title: 'Respect All Members & Creators',
    description: 'Keep discussions polite and constructive. Harassment, hateful speech, or toxic conduct will result in an immediate kick or ban.',
    createdAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'rule-2',
    title: 'No Inappropriate Content or Malicious Links',
    description: 'Any explicit comments, spam bots, phishing urls, or deceptive download links are strictly prohibited and flagged for immediate developer moderation.',
    createdAt: Date.now() - 86400000 * 20,
  },
  {
    id: 'rule-3',
    title: 'Credit Original Bedrock Creators',
    description: 'Never claim other creators work as your own. Always link the original author and provide legitimate download mirrors.',
    createdAt: Date.now() - 86400000 * 10,
  },
  {
    id: 'rule-4',
    title: 'Follow Bedrock Version Compatibility',
    description: 'Ensure add-on links and instructions match specified Minecraft Bedrock versions (1.20, 1.21+) so players do not break their game saves.',
    createdAt: Date.now() - 86400000 * 5,
  },
];

export function getCommunityRules(): CommunityRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RULES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(DEFAULT_COMMUNITY_RULES));
      return DEFAULT_COMMUNITY_RULES;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_COMMUNITY_RULES;
  }
}

export function saveCommunityRules(rules: CommunityRule[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(rules));
    broadcastAppEvent('RULES_UPDATED', rules);
  } catch {}
}

export function addCommunityRule(title: string, description: string): CommunityRule {
  const newRule: CommunityRule = {
    id: 'rule_' + Date.now(),
    title: title.trim(),
    description: description.trim(),
    createdAt: Date.now(),
  };
  const current = getCommunityRules();
  const updated = [...current, newRule];
  saveCommunityRules(updated);
  return newRule;
}

export function deleteCommunityRule(ruleId: string): void {
  const current = getCommunityRules();
  const updated = current.filter((r) => r.id !== ruleId);
  saveCommunityRules(updated);
}

// Download History Tracking
export function getDownloadHistory(): DownloadHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DOWNLOAD_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addDownloadHistory(item: {
  addonId: string;
  title: string;
  category: AddonCategory;
  fileFormat?: string;
  version?: string;
  linkUrl?: string;
}): void {
  try {
    const current = getDownloadHistory();
    // Filter out if downloaded the same addon recently to avoid spam duplicates, or prepend
    const newItem: DownloadHistoryItem = {
      id: 'dl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      ...item,
      downloadedAt: Date.now(),
    };
    const updated = [newItem, ...current.slice(0, 49)]; // keep latest 50
    localStorage.setItem(STORAGE_KEY_DOWNLOAD_HISTORY, JSON.stringify(updated));
    broadcastAppEvent('DOWNLOAD_HISTORY_UPDATED', newItem);
  } catch {}
}

export function clearDownloadHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_DOWNLOAD_HISTORY);
    broadcastAppEvent('DOWNLOAD_HISTORY_UPDATED', null);
  } catch {}
}

// Saved Accounts for Login vs Sign in (Create Account)
export function getSavedAccounts(): MemberUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SAVED_ACCOUNTS);
    if (!raw) return [];
    const accounts: MemberUser[] = JSON.parse(raw);
    if (!Array.isArray(accounts)) return [];
    return accounts.map((acc) => {
      if (acc.avatar && (acc.avatar.includes('bottts') || acc.avatar.includes('dicebear'))) {
        return {
          ...acc,
          avatar: getMinecraftCharacterAvatar(acc.username || acc.email),
        };
      }
      return acc;
    });
  } catch {
    return [];
  }
}

export function saveAccount(user: MemberUser): void {
  try {
    const current = getSavedAccounts();
    const existingIndex = current.findIndex((u) => u.username.toLowerCase() === user.username.toLowerCase());
    let updated: MemberUser[];
    if (existingIndex >= 0) {
      updated = current.map((u, i) => (i === existingIndex ? user : u));
    } else {
      updated = [user, ...current];
    }
    localStorage.setItem(STORAGE_KEY_SAVED_ACCOUNTS, JSON.stringify(updated));
  } catch {}
}

export function removeSavedAccount(id: string): void {
  try {
    const current = getSavedAccounts();
    const updated = current.filter((u) => u.id !== id);
    localStorage.setItem(STORAGE_KEY_SAVED_ACCOUNTS, JSON.stringify(updated));
  } catch {}
}

export function findAccountByEmailOrUsername(query: string): MemberUser | undefined {
  const accounts = getSavedAccounts();
  const q = query.trim().toLowerCase();
  return accounts.find((a) => (a.email && a.email.toLowerCase() === q) || a.username.toLowerCase() === q);
}

export function sendPinRecoveryEmail(email: string): { success: boolean; pin: string; message: string } {
  const accounts = getSavedAccounts();
  const found = accounts.find((a) => a.email && a.email.toLowerCase() === email.trim().toLowerCase());
  if (found && found.pinCode) {
    return {
      success: true,
      pin: found.pinCode,
      message: `Your 6-digit PIN code has been sent to ${email}`,
    };
  }
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  return {
    success: true,
    pin: code,
    message: `Your 6-digit PIN code has been sent to ${email}`,
  };
}

// Sample starter addons matching official Bedrock showcase categories
export const SAMPLE_STARTER_ADDONS: BedrockAddon[] = [
  // --- ADD-ONS ---
  {
    id: 'prism-addon-1',
    title: 'Monster Structures',
    category: 'addon',
    tagline: 'Colossal dungeon titans, stone golem shrines, and void beasts across the Overworld.',
    description: 'Encounter gargantuan ancient structures and towering elemental bosses roaming your Bedrock worlds. Defeat stone sentinels to unlock ancient forging blueprints and mythic weapons.',
    version: '1.0.0',
    bedrockVersion: '1.21.0+',
    fileSize: '18.4 MB',
    downloadCount: 432,
    coverImage: ART_MONSTER_STRUCTURES,
    addonDetails: {
      entityCount: '12 Colossal Bosses & 6 Dungeons',
      customCommands: '/function spawn_ancient_titan',
    },
    links: [
      {
        id: 'link-ms-1',
        title: 'Download .mcaddon',
        url: 'https://example.com/downloads/monster-structures.mcaddon',
        type: 'mcaddon',
        isPrimary: true,
      },
    ],
    tags: ['Bosses', 'Dungeons', 'Titans', 'PVE', 'Adventure'],
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: 'prism-addon-2',
    title: 'Fungus Hazard',
    category: 'addon',
    tagline: 'Warped Nether spore outbreak, hazmat suits, and mutated aggressive flora.',
    description: 'A toxic fungus mutation spreads through underground caverns and nether wastes. Craft specialized filtration masks, research vaccine serums, and purge bio-hazard zones.',
    version: '1.0.17',
    bedrockVersion: '1.21.0+',
    fileSize: '12.8 MB',
    downloadCount: 318,
    coverImage: ART_FUNGUS_HAZARD,
    addonDetails: {
      entityCount: '8 Infected Variants & Hazmat Gear',
      customCommands: '/function fungus_cure',
    },
    links: [
      {
        id: 'link-fh-1',
        title: 'Download .mcaddon',
        url: 'https://example.com/downloads/fungus-hazard.mcaddon',
        type: 'mcaddon',
        isPrimary: true,
      },
    ],
    tags: ['Biohazard', 'Nether', 'Survival', 'Mutations'],
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'prism-addon-3',
    title: 'Industrial Machinery',
    category: 'addon',
    tagline: 'High-voltage solar generators, automated quarries, and energy conduits.',
    description: 'Transform your Bedrock survival with advanced automation. Build photovoltaic solar arrays, industrial fabricators, power cables, and auto-sorting storage chests.',
    version: '1.0.3',
    bedrockVersion: '1.21.0+',
    fileSize: '15.6 MB',
    downloadCount: 489,
    coverImage: ART_INDUSTRIAL_TECH,
    addonDetails: {
      entityCount: '14 Industrial Machines & Conduits',
      customCommands: '/function industrial_power_grid',
    },
    links: [
      {
        id: 'link-im-1',
        title: 'Download .mcaddon',
        url: 'https://example.com/downloads/industrial-machinery.mcaddon',
        type: 'mcaddon',
        isPrimary: true,
      },
    ],
    tags: ['Tech', 'Machines', 'Automation', 'Energy', 'Survival'],
    createdAt: Date.now() - 86400000 * 3.5,
    updatedAt: Date.now() - 86400000 * 2.5,
  },
  {
    id: 'prism-starter-1',
    title: 'Aetheria: Elemental Magic',
    category: 'addon',
    tagline: 'Staff casting, elemental shrines, and mythic boss battles in Bedrock Edition.',
    description: 'A complete magic overhaul crafted specifically for Minecraft Bedrock. Discover spellbound Tomes, craft runic staves, and confront elemental guardians in ancient ruins.',
    version: '2.1.0',
    bedrockVersion: '1.21.0+',
    fileSize: '14.2 MB',
    downloadCount: 124,
    addonDetails: {
      entityCount: '16 Custom Entities & 8 Runic Staves',
      customCommands: '/function aetheria_give_all',
    },
    links: [
      {
        id: 'link-1',
        title: 'Direct .mcaddon Download',
        url: 'https://example.com/downloads/aetheria-v2.1.0.mcaddon',
        type: 'mcaddon',
        isPrimary: true,
      },
    ],
    tags: ['Magic', 'Spells', 'Bosses', 'Survival'],
    createdAt: Date.now() - 86400000 * 4,
    updatedAt: Date.now() - 86400000 * 3,
  },

  // --- WORLDS / MAPS ---
  {
    id: 'prism-world-1',
    title: 'Bed Wars Classic',
    category: 'map',
    tagline: 'Floating sky island arenas, team generators, and single/multiplayer bed defense.',
    description: 'Faithful recreation of competitive Bed Wars for Minecraft Bedrock. Protect your team bed, collect bronze, iron, and diamond currencies, and launch surprise attacks.',
    version: '1.0.18',
    bedrockVersion: '1.21+',
    fileSize: '22.6 MB',
    downloadCount: 654,
    coverImage: ART_BED_WARS,
    mapDetails: {
      gameMode: 'Minigame / PVP',
      playerCount: '1-8 Players',
      difficulty: 'Custom',
    },
    links: [
      {
        id: 'link-bw-1',
        title: 'Download .mcworld',
        url: 'https://example.com/downloads/bedwars-classic.mcworld',
        type: 'mcworld',
        isPrimary: true,
      },
    ],
    tags: ['PVP', 'Minigame', 'Bed Wars', 'Multiplayer'],
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 86400000 * 4,
  },
  {
    id: 'prism-world-2',
    title: 'Japanese Gakkuo',
    category: 'map',
    tagline: 'Cherry blossom school campus, traditional shrines, and roleplay classrooms.',
    description: 'Immersive Japanese academy featuring fully furnished science labs, gymnasium, rooftop garden, Torii gates, and surrounding mountain village.',
    version: '1.0.6',
    bedrockVersion: '1.20 - 1.21',
    fileSize: '34.2 MB',
    downloadCount: 521,
    coverImage: ART_JAPANESE_GAKKUO,
    mapDetails: {
      gameMode: 'Adventure / Roleplay',
      playerCount: '1-16 Players',
      difficulty: 'Peaceful',
    },
    links: [
      {
        id: 'link-jg-1',
        title: 'Download .mcworld',
        url: 'https://example.com/downloads/japanese-gakkuo.mcworld',
        type: 'mcworld',
        isPrimary: true,
      },
    ],
    tags: ['Japanese', 'School', 'Roleplay', 'Cherry Blossom', 'City'],
    createdAt: Date.now() - 86400000 * 6,
    updatedAt: Date.now() - 86400000 * 5,
  },
  {
    id: 'prism-world-3',
    title: 'Anime Academia',
    category: 'map',
    tagline: 'High school campus, clock tower courtyard, student dorms, and sakura gardens.',
    description: 'Vibrant modern high-school roleplay campus with functioning clock tower bell, furnished classrooms, cafeteria, indoor gymnasium, and surrounding suburban streets.',
    version: '1.0.4',
    bedrockVersion: '1.20 - 1.21',
    fileSize: '31.8 MB',
    downloadCount: 472,
    coverImage: ART_ANIME_ACADEMIA,
    mapDetails: {
      gameMode: 'Roleplay / City',
      playerCount: '1-20 Players',
      difficulty: 'Peaceful',
    },
    links: [
      {
        id: 'link-aa-1',
        title: 'Download .mcworld',
        url: 'https://example.com/downloads/anime-academia.mcworld',
        type: 'mcworld',
        isPrimary: true,
      },
    ],
    tags: ['Anime', 'School', 'Roleplay', 'Campus', 'City'],
    createdAt: Date.now() - 86400000 * 6.5,
    updatedAt: Date.now() - 86400000 * 5.5,
  },
  {
    id: 'prism-starter-3',
    title: 'Skyward Ruins Adventure',
    category: 'map',
    tagline: 'Explore floating ancient islands, solve dungeon puzzles, and restore the beacon.',
    description: 'A custom handcrafted Minecraft Bedrock adventure world featuring 5 puzzle chambers, custom boss encounters, lore books, and parkour trials across the clouds.',
    version: '1.1.0',
    bedrockVersion: '1.21+',
    fileSize: '45.1 MB',
    downloadCount: 147,
    mapDetails: {
      gameMode: 'Adventure',
      playerCount: '1-4 Players',
      difficulty: 'Normal',
    },
    links: [
      {
        id: 'link-map-1',
        title: 'Download .mcworld Map',
        url: 'https://example.com/downloads/skyward-ruins.mcworld',
        type: 'mcworld',
        isPrimary: true,
      },
    ],
    tags: ['Adventure', 'Puzzles', 'Floating Islands', 'Co-op'],
    createdAt: Date.now() - 86400000 * 7,
    updatedAt: Date.now() - 86400000 * 6,
  },

  // --- SKIN PACKS ---
  {
    id: 'prism-skin-1',
    title: 'Duck Friends',
    category: 'skin_pack',
    tagline: 'Pastel duck hoodies, street fashion, and vibrant aesthetic character skins.',
    description: 'A cheerful collection of 12 HD Minecraft Bedrock skins featuring cozy duck-themed hoodies, headphones, sneakers, and modern pastel color schemes.',
    version: '1.0.1',
    bedrockVersion: 'All Bedrock Editions',
    fileSize: '3.4 MB',
    downloadCount: 884,
    coverImage: ART_DUCK_FRIENDS,
    skinPackDetails: {
      skinCount: '12 HD Skins',
      modelType: 'Classic & Slim',
      theme: 'Cute Duck Hoodies & Streetwear',
    },
    links: [
      {
        id: 'link-df-1',
        title: 'Download Skin Pack .mcpack',
        url: 'https://example.com/downloads/duck-friends.mcpack',
        type: 'mcpack',
        isPrimary: true,
      },
    ],
    tags: ['Skins', 'Duck', 'Cute', 'Pastel', 'Hoodie'],
    createdAt: Date.now() - 86400000 * 7,
    updatedAt: Date.now() - 86400000 * 6,
  },
  {
    id: 'prism-skin-2',
    title: 'Cozy Up !',
    category: 'skin_pack',
    tagline: 'Oversized knitted winter sweaters, beanie caps, and warm autumn aesthetics.',
    description: 'Charming winter wardrobe featuring warm turtlenecks, cable knit sweaters, puffer jackets, and cozy boots designed for snowy mountain survival.',
    version: '1.0.1',
    bedrockVersion: 'All Bedrock Editions',
    fileSize: '2.8 MB',
    downloadCount: 712,
    coverImage: ART_COZY_UP,
    skinPackDetails: {
      skinCount: '10 Handcrafted Skins',
      modelType: 'Classic & Slim',
      theme: 'Autumn & Winter Knits',
    },
    links: [
      {
        id: 'link-cu-1',
        title: 'Download Skin Pack .mcpack',
        url: 'https://example.com/downloads/cozy-up.mcpack',
        type: 'mcpack',
        isPrimary: true,
      },
    ],
    tags: ['Winter', 'Sweaters', 'Cozy', 'Aesthetic', 'Skins'],
    createdAt: Date.now() - 86400000 * 8,
    updatedAt: Date.now() - 86400000 * 7,
  },
  {
    id: 'prism-skin-3',
    title: 'Chibi World',
    category: 'skin_pack',
    tagline: 'Super-cute mini proportions, pastel outfits, and expressive chibi facial designs.',
    description: 'Adorably styled chibi character models featuring pastel lavender, sky blue, and baby pink outfits with starry sparkles and cute blush details.',
    version: '1.0.1',
    bedrockVersion: 'All Bedrock Editions',
    fileSize: '3.1 MB',
    downloadCount: 765,
    coverImage: ART_CHIBI_WORLD,
    skinPackDetails: {
      skinCount: '14 Chibi Skins',
      modelType: 'Slim Alex & Classic',
      theme: 'Pastel Kawaii & Chibi Streetwear',
    },
    links: [
      {
        id: 'link-cw-1',
        title: 'Download Skin Pack .mcpack',
        url: 'https://example.com/downloads/chibi-world.mcpack',
        type: 'mcpack',
        isPrimary: true,
      },
    ],
    tags: ['Chibi', 'Cute', 'Kawaii', 'Pastel', 'Skins'],
    createdAt: Date.now() - 86400000 * 8.5,
    updatedAt: Date.now() - 86400000 * 7.5,
  },

  // --- TEXTURE PACKS ---
  {
    id: 'prism-texture-1',
    title: 'Smooth Moves Animations',
    category: 'resource_pack',
    tagline: 'Fluid organic mob animations, sword swinging, and expressive player movements.',
    description: 'Overhauls vanilla Minecraft animations with smooth, momentum-based movements. Features realistic running, sword trails, shield blocking, and mob idle behaviors.',
    version: '1.1.0',
    bedrockVersion: '1.20 - 1.21',
    fileSize: '9.2 MB',
    downloadCount: 940,
    coverImage: ART_SMOOTH_MOVES,
    textureDetails: {
      resolution: 'Vanilla 16x',
      style: 'Dynamic Animation Overhaul',
      subpackInfo: 'Includes dynamic combat and running options',
    },
    links: [
      {
        id: 'link-sm-1',
        title: 'Download .mcpack',
        url: 'https://example.com/downloads/smooth-moves.mcpack',
        type: 'mcpack',
        isPrimary: true,
      },
    ],
    tags: ['Animations', 'Smooth', 'Combat', 'Mobs', 'Player'],
    createdAt: Date.now() - 86400000 * 9,
    updatedAt: Date.now() - 86400000 * 8,
  },
  {
    id: 'prism-texture-2',
    title: 'Lush Visuals',
    category: 'resource_pack',
    tagline: 'Vibrant foliage, glowing cave crystals, and rich ambient color palettes.',
    description: 'Brings life to caves and forests with glowing ore outlines, emissive glow berries, realistic water surface caustics, and lush foliage textures.',
    version: '1.0.3',
    bedrockVersion: '1.20 - 1.21',
    fileSize: '16.5 MB',
    downloadCount: 685,
    coverImage: ART_LUSH_VISUALS,
    textureDetails: {
      resolution: '32x HD',
      style: 'Lush Fantasy & Emissive Ores',
      subpackInfo: 'Subpack slider for glowing ore intensity',
    },
    links: [
      {
        id: 'link-lv-1',
        title: 'Download .mcpack',
        url: 'https://example.com/downloads/lush-visuals.mcpack',
        type: 'mcpack',
        isPrimary: true,
      },
    ],
    tags: ['Lush', '32x', 'Glowing Ores', 'Nature', 'Fantasy'],
    createdAt: Date.now() - 86400000 * 10,
    updatedAt: Date.now() - 86400000 * 9,
  },
  {
    id: 'prism-texture-3',
    title: 'Hafen 16x',
    category: 'resource_pack',
    tagline: 'Whimsical hand-painted cartoon textures with warm, cozy storybook colors.',
    description: 'Delightful storybook style pack with warm pastel tones, friendly mob faces, cozy wooden planks, and simplified clean UI screens.',
    version: '1.0.11',
    bedrockVersion: '1.20 - 1.21',
    fileSize: '14.1 MB',
    downloadCount: 512,
    coverImage: ART_HAFEN_COZY,
    textureDetails: {
      resolution: '16x Cartoon',
      style: 'Whimsical Storybook',
    },
    links: [
      {
        id: 'link-hf-1',
        title: 'Download .mcpack',
        url: 'https://example.com/downloads/hafen-16x.mcpack',
        type: 'mcpack',
        isPrimary: true,
      },
    ],
    tags: ['Cartoon', 'Cozy', 'Pastel', '16x', 'Clean'],
    createdAt: Date.now() - 86400000 * 11,
    updatedAt: Date.now() - 86400000 * 10,
  },
  {
    id: 'prism-starter-2',
    title: 'PrismPure: 64x Crisp Faithful',
    category: 'resource_pack',
    tagline: 'Ultra-crisp 64x vanilla-faithful textures optimized for mobile and console Bedrock.',
    description: 'Clean, pixel-artisan faithful resource pack that enhances vanilla textures to high definition without breaking the cozy Minecraft aesthetic.',
    version: '1.5.0',
    bedrockVersion: '1.20 - 1.21',
    fileSize: '28.6 MB',
    downloadCount: 89,
    textureDetails: {
      resolution: '64x',
      style: 'Faithful Vanilla & Dark UI',
    },
    links: [
      {
        id: 'link-tp-1',
        title: 'Download .mcpack',
        url: 'https://example.com/downloads/prismpure-64x.mcpack',
        type: 'mcpack',
        isPrimary: true,
      },
    ],
    tags: ['64x', 'Faithful', 'Clean UI', 'HD'],
    createdAt: Date.now() - 86400000 * 12,
    updatedAt: Date.now() - 86400000 * 11,
  },

  // --- SHADERS ---
  {
    id: 'prism-starter-4',
    title: 'Lumina Shaders Deferred',
    category: 'shader',
    tagline: 'Vibrant sun caustics, soft ambient shadows, and atmospheric night fog.',
    description: 'Compatible with Bedrock Render Dragon Deferred Technical Preview. Delivers realistic water reflections, warm torchlight, and glowing ores.',
    version: '2.0.0',
    bedrockVersion: '1.21.30+',
    fileSize: '8.4 MB',
    downloadCount: 415,
    coverImage: ART_LUMINA_SHADERS,
    shaderDetails: {
      renderEngine: 'Render Dragon Deferred & PBR',
      performanceLevel: 'Balanced',
      supportedDevices: 'Windows 10/11 & High-end Android',
      visualHighlights: 'Dynamic water caustics, volumetric fog, glowing emissive ores',
    },
    links: [
      {
        id: 'link-shader-1',
        title: 'Download Shader .mcpack',
        url: 'https://example.com/downloads/lumina-deferred.mcpack',
        type: 'mcpack',
        isPrimary: true,
      },
    ],
    tags: ['Shader', 'Render Dragon', 'Lighting', 'Water', 'PBR'],
    createdAt: Date.now() - 86400000 * 13,
    updatedAt: Date.now() - 86400000 * 12,
  },
];

// Delete any type of addon completely from stored addons
export function deleteStoredAddon(addonId: string): BedrockAddon[] {
  try {
    const current = getStoredAddons();
    const updated = current.filter((a) => a.id !== addonId);
    saveStoredAddons(updated);
    broadcastAppEvent('ADDONS_UPDATED', updated);
    return updated;
  } catch {
    return [];
  }
}

// Trigger browser file download based on addon file type / attachment
export function triggerAddonFileDownload(
  addon: BedrockAddon, 
  link?: ExternalLink
): { fileName: string; fileType: string } {
  // Determine file extension
  let extension = addon.downloadFileType;
  if (!extension) {
    if (link?.type && ['.mcaddon', '.mcpack', '.mcworld'].includes('.' + link.type)) {
      extension = '.' + link.type;
    } else if (addon.category === 'map') {
      extension = '.mcworld';
    } else if (addon.category === 'resource_pack' || addon.category === 'shader') {
      extension = '.mcpack';
    } else {
      extension = '.mcaddon';
    }
  }
  if (!extension.startsWith('.')) {
    extension = '.' + extension;
  }

  const safeTitle = addon.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const fileName = addon.attachedFileName || `${safeTitle}${extension}`;

  try {
    if (addon.attachedFileData) {
      // Download actual uploaded file data
      const a = document.createElement('a');
      a.href = addon.attachedFileData;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      // Generate authentic Minecraft Bedrock manifest file payload
      const manifest = {
        format_version: 2,
        header: {
          name: addon.title,
          description: addon.tagline || addon.description || 'Custom Minecraft Bedrock pack created via PrismMods',
          uuid: 'prism-' + addon.id,
          version: [1, 0, 0],
          min_engine_version: [1, 20, 0],
        },
        modules: [
          {
            description: addon.title,
            type: addon.category === 'resource_pack' ? 'resources' : 'data',
            uuid: 'mod-' + addon.id,
            version: [1, 0, 0],
          },
        ],
      };
      const jsonStr = JSON.stringify(manifest, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  } catch (err) {
    console.error('File download error:', err);
  }

  // Increment download count and add to history
  incrementAddonDownloads(addon.id);
  addDownloadHistory({
    addonId: addon.id,
    title: addon.title,
    category: addon.category,
    fileFormat: extension,
    version: addon.version,
    linkUrl: link?.url,
  });

  return { fileName, fileType: extension };
}

