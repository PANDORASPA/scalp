export function getHumanErrorMessage(error: string) {
  if (error.includes('invalid_json')) return '送出的資料格式不正確，請重新嘗試。'
  if (error.includes('not_found')) return '找不到相關資料，可能已被刪除；請重新整理頁面。'
  if (error.includes('customer_id_required') || error.includes('customer_id_and_check_date_required')) {
    return '請先選擇客人及檢查日期。'
  }
  if (error.includes('customer_not_found')) return '找不到這位客人，請重新選擇客人。'
  if (error.includes('name_required')) return '請輸入至少 2 個字元的客人姓名。'
  if (error.includes('invalid_phone')) return '電話格式不正確，請只輸入數字、空格或 +()- 符號。'
  if (error.includes('invalid_check_date') || error.includes('invalid_session_date')) {
    return '檢查日期格式不正確，請重新選擇。'
  }
  if (error.includes('file_required')) return '請先選擇圖片。'
  if (error.includes('file_empty')) return '圖片檔案是空的，請重新選擇圖片。'
  if (error.includes('invalid_file_type')) return '只接受 JPG、PNG 或 WebP 圖片。'
  if (error.includes('file_too_large')) return '圖片不可大於 8MB，請壓縮後再上傳。'
  if (error.includes('missing_required_fields')) return '圖片資料不完整，請重新選擇部位及圖片編號。'
  if (error.includes('invalid_multipart_form')) return '圖片表單格式不正確，請重新選擇圖片後再試。'
  if (error.includes('capture_points_missing')) return '固定拍攝部位尚未完成設定，請先執行 Supabase migration。'
  if (error.includes('incomplete_images')) return '此部位需要 3 張圖片，而且每張都要確認標記後才可計算平均。'
  if (error.includes('storage_provider')) return '圖片儲存設定不完整，請到系統設定檢查 Google Drive。'
  if (error.includes('private_image_proxy_unavailable')) return '私有圖片 proxy 尚未啟用，請檢查 storage adapter 設定。'
  if (
    error.includes('supabase_env_missing') ||
    error.includes('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required') ||
    error.includes('Supabase server env is not configured')
  ) {
    return 'Supabase 尚未設定完成，暫時不能儲存資料。請到系統設定檢查環境變數。'
  }
  if (error.includes('supabase_connection_failed')) {
    return 'Supabase 連線失敗，暫時不能儲存客人或紀錄。請到 Supabase Project Settings > API 複製正確 Project URL 和 service_role key，更新 Vercel env 後重新部署。'
  }
  if (error.includes('mock_db_corrupt')) {
    return 'Local mock database is corrupted. Stop the local server and restore or remove .data/mock-db.json; deployed environments never use local mock data.'
  }
  if (error.includes('mock_db_locked')) {
    return 'The local mock database is busy. Wait briefly and try again.'
  }
  if (error.includes('google_drive_auth_failed')) {
    return 'Google Drive 認證失敗，請檢查 service account email / private key。'
  }
  if (error.includes('upload_failed')) {
    return '圖片上傳失敗，請檢查 Google Drive folder 權限與 credential。'
  }
  if (error.includes('storage_cleanup_failed')) {
    return 'Storage cleanup failed. The record was kept so the operator can fix permissions and retry deletion.'
  }
  if (error.includes('ai_analysis_failed')) {
    return 'AI 初步分析失敗，但圖片資料可保留；請稍後重試或先用人工確認。'
  }
  if (error.includes('annotations_required')) {
    return '請先確認或新增標記，然後再儲存。'
  }
  if (error.includes('ai_retry_not_allowed')) return '這張圖片目前不需要重新分析，請先完成或重新上傳。'
  return error || '操作失敗，請稍後再試。'
}
