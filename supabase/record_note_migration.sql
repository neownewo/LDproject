ALTER TABLE public.gacha_records
ADD COLUMN IF NOT EXISTS note VARCHAR(100);

COMMENT ON COLUMN public.gacha_records.note
IS '使用者自訂抽卡紀錄備註，最多 100 字';

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.gacha_records
TO service_role;
