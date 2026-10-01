-- Page-specific defaults in the existing presentation model; never overwrite editorial state.
-- Counts/sizes are reconciled with live Joomla IDs and the versioned public page mapping.
BEGIN;
WITH pages(target_type,target_key,sidebar_count,has_top,square_first) AS (VALUES
 ('homepage',NULL::text,10,true,true),
 ('experts_directory',NULL,0,false,false),
 ('portal_area','mottoreisen',0,false,false),
 ('portal_area','reiseziele',0,false,false),
 ('portal_area','mottoreisen/natur-pur',9,true,true),
 ('portal_area','mottoreisen/nordic-walking',7,true,false),
 ('portal_area','mottoreisen/radwandern',8,true,true),
 ('portal_area','mottoreisen/wanderurlaub',6,true,false),
 ('portal_area','mottoreisen/familienurlaub',10,true,true),
 ('portal_area','mottoreisen/golfurlaub',6,true,false),
 ('portal_area','mottoreisen/tauchurlaub',8,true,false),
 ('portal_area','mottoreisen/urlaub-am-wasser',6,true,true),
 ('portal_area','mottoreisen/campingurlaub',5,true,true),
 ('portal_area','mottoreisen/romantik-zu-zweit',5,false,false),
 ('portal_area','mottoreisen/wellnessangebote',6,true,false),
 ('portal_area','mottoreisen/geschaeftsreisen',6,true,true),
 ('portal_area','reiseziele/deutschland',7,true,true),
 ('portal_area','reiseziele/oesterreich',8,true,false),
 ('portal_area','reiseziele/schweiz',3,false,false),
 ('portal_area','reiseziele/suedtirol-italien',8,true,false)
), slots(placement,position) AS (VALUES
 ('top_banner',0),('sidebar_top',1),('sidebar_middle',2),('sidebar_bottom',3),
 ('sidebar_04',4),('sidebar_05',5),('sidebar_06',6),('sidebar_07',7),
 ('sidebar_08',8),('sidebar_09',9),('sidebar_10',10),('sidebar_11',11),('sidebar_12',12)
)
INSERT INTO public.ad_slot_presentations(target_type,target_key,placement,size,legacy_hidden,legacy_placement)
SELECT target_type,target_key,placement,
 CASE WHEN position=1 AND square_first THEN 'large' ELSE 'small' END,
 CASE WHEN position=0 THEN NOT has_top ELSE position>sidebar_count END,
 CASE WHEN position=0 THEN NULL ELSE placement END
FROM pages CROSS JOIN slots
ON CONFLICT(target_type,target_key,placement) DO NOTHING;
COMMIT;
