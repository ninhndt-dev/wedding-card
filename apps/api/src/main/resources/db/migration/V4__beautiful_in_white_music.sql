UPDATE editor_documents
SET draft = CASE
      WHEN JSON_UNQUOTE(JSON_EXTRACT(draft, '$.music.src')) = '/audio/ngay_xuan_vui_cuoi_(giao_huong_tan_thoi).m4a'
      THEN JSON_SET(draft, '$.music.src', '/audio/beautiful-in-white-shane-filan.mp3')
      ELSE draft
    END,
    published = CASE
      WHEN JSON_UNQUOTE(JSON_EXTRACT(published, '$.music.src')) = '/audio/ngay_xuan_vui_cuoi_(giao_huong_tan_thoi).m4a'
      THEN JSON_SET(published, '$.music.src', '/audio/beautiful-in-white-shane-filan.mp3')
      ELSE published
    END,
    revision = revision + 1,
    updated = CURRENT_TIMESTAMP
WHERE JSON_UNQUOTE(JSON_EXTRACT(draft, '$.music.src')) = '/audio/ngay_xuan_vui_cuoi_(giao_huong_tan_thoi).m4a'
   OR JSON_UNQUOTE(JSON_EXTRACT(published, '$.music.src')) = '/audio/ngay_xuan_vui_cuoi_(giao_huong_tan_thoi).m4a';
