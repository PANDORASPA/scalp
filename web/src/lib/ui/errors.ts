export function getHumanErrorMessage(error: string) {
  if (error.includes('supabase_env_missing')) {
    return 'Supabase 尚未設定完成，暫時不能儲存資料。請到系統設定檢查環境變數。'
  }
  if (error.includes('google_drive_auth_failed')) {
    return 'Google Drive 認證失敗，請檢查 service account email / private key。'
  }
  if (error.includes('upload_failed')) {
    return '圖片上傳失敗，請檢查 Google Drive folder 權限與 credential。'
  }
  if (error.includes('ai_analysis_failed')) {
    return 'AI 初步分析失敗，但圖片資料可保留；請稍後重試或先用人工確認。'
  }
  if (error.includes('annotations_required')) {
    return '請先確認或新增標記，然後再儲存。'
  }
  return error || '操作失敗，請稍後再試。'
}
