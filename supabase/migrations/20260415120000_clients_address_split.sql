-- Split clients.address into street, postal_code, city, province
ALTER TABLE clients ADD COLUMN IF NOT EXISTS street TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS province TEXT;

UPDATE clients
SET street = address
WHERE address IS NOT NULL
  AND btrim(address) <> ''
  AND (street IS NULL OR btrim(street) = '');

ALTER TABLE clients DROP COLUMN IF EXISTS address;
