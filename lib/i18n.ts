export type Locale = 'zh-TW' | 'en'

const DICT: Record<string, Record<Locale, string>> = {
  'nav.home':        { 'zh-TW': '首頁', en: 'Home' },
  'action.submit':   { 'zh-TW': '送出', en: 'Submit' },
  'action.cancel':   { 'zh-TW': '取消', en: 'Cancel' },
  'action.new':      { 'zh-TW': '新增申請', en: 'New Request' },
  'action.logout':   { 'zh-TW': '登出', en: 'Sign out' },
  'status.draft':     { 'zh-TW': '草稿', en: 'Draft' },
  'status.in_review': { 'zh-TW': '審核中', en: 'In Review' },
  'status.approved':  { 'zh-TW': '已核准', en: 'Approved' },
  'status.rejected':  { 'zh-TW': '已駁回', en: 'Rejected' },
  'status.returned':  { 'zh-TW': '退回', en: 'Returned' },
  'status.cancelled': { 'zh-TW': '已取消', en: 'Cancelled' },
  'list.empty':       { 'zh-TW': '尚無資料', en: 'No data' },
  'list.loading':     { 'zh-TW': '載入中...', en: 'Loading...' },
}

export function t(key: string, locale: Locale = 'zh-TW'): string {
  return DICT[key]?.[locale] ?? key
}
