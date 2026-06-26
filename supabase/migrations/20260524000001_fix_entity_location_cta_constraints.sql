-- Align entity_type CHECK with form options
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_entity_type_check;
ALTER TABLE listings ADD CONSTRAINT listings_entity_type_check
  CHECK (entity_type IN ('business','restaurant','service_provider','professional','creative','vendor'));

-- Drop old location_type constraint BEFORE migrating data (old constraint blocks 'virtual' etc.)
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_location_type_check;

-- Migrate existing location_type values from old DB values to new form values
UPDATE listings SET location_type = 'virtual'       WHERE location_type = 'online';
UPDATE listings SET location_type = 'service_area'  WHERE location_type = 'virtual-services';
UPDATE listings SET location_type = 'national'      WHERE location_type = 'ships-nationwide';

-- Add new location_type constraint with form values
ALTER TABLE listings ADD CONSTRAINT listings_location_type_check
  CHECK (location_type IN ('physical','virtual','hybrid','service_area','national','traveling'));

-- Align cta_type CHECK with form options
ALTER TABLE listing_details_business DROP CONSTRAINT IF EXISTS listing_details_business_cta_type_check;
ALTER TABLE listing_details_business ADD CONSTRAINT listing_details_business_cta_type_check
  CHECK (cta_type IN ('book','order','call','message','visit','get-quote','shop','subscribe',
                      'contact','commission','inquire','get-tickets','rsvp','register',
                      'learn-more','apply','buy-now'));
