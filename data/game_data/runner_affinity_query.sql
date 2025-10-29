WITH AffinityBonuses AS (
    SELECT
        SRM1.chara_id AS id1,
        SRM2.chara_id AS id2,
        SUM(SR.relation_point) AS total_bonus
    FROM
        succession_relation_member AS SRM1
    JOIN
        succession_relation_member AS SRM2
        ON SRM1.relation_type = SRM2.relation_type
        AND SRM1.chara_id < SRM2.chara_id
    JOIN
        succession_relation AS SR
        ON SRM1.relation_type = SR.relation_type
    GROUP BY
        SRM1.chara_id, SRM2.chara_id
),
-- Subquery 2: Get the master list of runners (We know this works)
RunnerNames AS (
    SELECT
        "index",
        MAX(text) AS name
    FROM
        text_data
    WHERE
        category IN (6)
    GROUP BY
        "index"
)
-- Main Query: Build pairs from the RUNNERS list
SELECT
    R1.name AS chara1_name,
    
    -- If no bonus is found (NULL), set the score to 0
    COALESCE(AB.total_bonus, 0) AS affinity_score,
    
    R2.name AS chara2_name
FROM
    -- Use the working name query as the master list
    RunnerNames AS R1
JOIN
    -- Pair every runner with every other runner
    RunnerNames AS R2 ON R1."index" < R2."index"
LEFT JOIN
    -- LEFT JOIN the bonus scores
    AffinityBonuses AS AB ON R1."index" = AB.id1 AND R2."index" = AB.id2
ORDER BY
    affinity_score DESC