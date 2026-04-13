-- Migration script to fix duplicate labels with different casing
-- This script will merge duplicate labels and consolidate their stock movements

-- Create a temporary table to track label mergers
CREATE TEMPORARY TABLE label_merges AS
WITH duplicate_labels AS (
  SELECT 
    LOWER(name) as normalized_name,
    array_agg(id ORDER BY createdAt) as label_ids,
    array_agg(name ORDER BY createdAt) as original_names,
    array_agg(createdAt ORDER BY createdAt) as creation_times,
    COUNT(*) as duplicate_count
  FROM "Label" 
  GROUP BY LOWER(name)
  HAVING COUNT(*) > 1
)
SELECT 
  normalized_name,
  label_ids[1] as keep_label_id,  -- Keep the oldest label
  label_ids[2:] as merge_label_ids, -- Merge newer labels
  original_names[1] as keep_name,
  array_slice(original_names, 2, array_length(original_names, 1)) as merge_names
FROM duplicate_labels;

-- Update label movements to point to the kept labels
UPDATE "LabelMovement" 
SET "labelId" = lm.keep_label_id
FROM label_merges lm
WHERE "LabelMovement"."labelId" = ANY(lm.merge_label_ids);

-- Update product labels to point to the kept labels
UPDATE "ProductLabel" 
SET "labelId" = lm.keep_label_id
FROM label_merges lm
WHERE "ProductLabel"."labelId" = ANY(lm.merge_label_ids);

-- Delete the duplicate labels (now that they have no references)
DELETE FROM "Label" 
WHERE id IN (
  SELECT unnest(merge_label_ids) FROM label_merges
);

-- Optional: Update all label names to lowercase for consistency
UPDATE "Label" 
SET name = LOWER(name);

-- Drop the temporary table
DROP TABLE IF EXISTS label_merges;
