use sqlx::SqlitePool;

use super::models::{
    Issue, IssueComment, IssueLabel, IssueStatus, NewIssue, NewIssueLabel, Pagination,
    UpdateIssue, UpdateIssueLabel,
};

pub async fn list_issues(
    pool: &SqlitePool,
    environment_id: i64,
    pagination: Pagination,
) -> Result<Vec<Issue>, sqlx::Error> {
    sqlx::query_as::<_, Issue>(
        "SELECT * FROM issues WHERE environment_id = ?
         ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(environment_id)
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

pub async fn list_issues_by_status(
    pool: &SqlitePool,
    environment_id: i64,
    status: IssueStatus,
    pagination: Pagination,
) -> Result<Vec<Issue>, sqlx::Error> {
    sqlx::query_as::<_, Issue>(
        "SELECT * FROM issues WHERE environment_id = ? AND status = ?
         ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(environment_id)
    .bind(status)
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

pub async fn list_issues_by_plant(
    pool: &SqlitePool,
    plant_id: i64,
    pagination: Pagination,
) -> Result<Vec<Issue>, sqlx::Error> {
    sqlx::query_as::<_, Issue>(
        "SELECT * FROM issues WHERE plant_id = ?
         ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(plant_id)
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

pub async fn get_issue(pool: &SqlitePool, id: i64) -> Result<Option<Issue>, sqlx::Error> {
    sqlx::query_as::<_, Issue>("SELECT * FROM issues WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_issue(pool: &SqlitePool, input: NewIssue) -> Result<Issue, sqlx::Error> {
    let status = input.status.unwrap_or(IssueStatus::New);
    let priority = input.priority.unwrap_or(super::models::IssuePriority::Medium);
    let result = sqlx::query(
        "INSERT INTO issues
            (environment_id, plant_id, location_id, title, description, status, priority)
         VALUES (?,?,?,?,?,?,?)",
    )
    .bind(input.environment_id)
    .bind(input.plant_id)
    .bind(input.location_id)
    .bind(&input.title)
    .bind(&input.description)
    .bind(status)
    .bind(priority)
    .execute(pool)
    .await?;

    get_issue(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn update_issue(
    pool: &SqlitePool,
    id: i64,
    input: UpdateIssue,
) -> Result<Option<Issue>, sqlx::Error> {
    // Set closed_at when status changes to 'closed'.
    let closed_at_expr = match &input.status {
        Some(IssueStatus::Closed) => "COALESCE(closed_at, datetime('now'))",
        _ => "closed_at",
    };
    let sql = format!(
        "UPDATE issues SET
            title       = COALESCE(?, title),
            description = COALESCE(?, description),
            status      = COALESCE(?, status),
            priority    = COALESCE(?, priority),
            plant_id    = COALESCE(?, plant_id),
            location_id = COALESCE(?, location_id),
            closed_at   = {closed_at_expr},
            updated_at  = datetime('now')
         WHERE id = ?"
    );
    sqlx::query(&sql)
        .bind(input.title)
        .bind(input.description)
        .bind(input.status)
        .bind(input.priority)
        .bind(input.plant_id)
        .bind(input.location_id)
        .bind(id)
        .execute(pool)
        .await?;

    get_issue(pool, id).await
}

pub async fn delete_issue(pool: &SqlitePool, id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM issues WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

// ---------------------------------------------------------------------------
// Issue labels
// ---------------------------------------------------------------------------

pub async fn list_labels(pool: &SqlitePool) -> Result<Vec<IssueLabel>, sqlx::Error> {
    sqlx::query_as::<_, IssueLabel>("SELECT * FROM issue_labels ORDER BY name ASC")
        .fetch_all(pool)
        .await
}

pub async fn add_label_to_issue(
    pool: &SqlitePool,
    issue_id: i64,
    label_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT OR IGNORE INTO issue_label_map (issue_id, label_id) VALUES (?, ?)",
    )
    .bind(issue_id)
    .bind(label_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn remove_label_from_issue(
    pool: &SqlitePool,
    issue_id: i64,
    label_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM issue_label_map WHERE issue_id = ? AND label_id = ?")
        .bind(issue_id)
        .bind(label_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_labels_for_issue(
    pool: &SqlitePool,
    issue_id: i64,
) -> Result<Vec<IssueLabel>, sqlx::Error> {
    sqlx::query_as::<_, IssueLabel>(
        "SELECT il.* FROM issue_labels il
         JOIN issue_label_map ilm ON il.id = ilm.label_id
         WHERE ilm.issue_id = ?
         ORDER BY il.name ASC",
    )
    .bind(issue_id)
    .fetch_all(pool)
    .await
}

// ---------------------------------------------------------------------------
// Issue comments
// ---------------------------------------------------------------------------

pub async fn list_comments(
    pool: &SqlitePool,
    issue_id: i64,
) -> Result<Vec<IssueComment>, sqlx::Error> {
    sqlx::query_as::<_, IssueComment>(
        "SELECT * FROM issue_comments WHERE issue_id = ? ORDER BY created_at ASC",
    )
    .bind(issue_id)
    .fetch_all(pool)
    .await
}

pub async fn add_comment(
    pool: &SqlitePool,
    issue_id: i64,
    body: String,
) -> Result<IssueComment, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO issue_comments (issue_id, body) VALUES (?, ?)",
    )
    .bind(issue_id)
    .bind(&body)
    .execute(pool)
    .await?;

    sqlx::query_as::<_, IssueComment>(
        "SELECT * FROM issue_comments WHERE id = ?",
    )
    .bind(result.last_insert_rowid())
    .fetch_one(pool)
    .await
}

pub async fn delete_comment(pool: &SqlitePool, id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM issue_comments WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

// ---------------------------------------------------------------------------
// Label CRUD
// ---------------------------------------------------------------------------

pub async fn get_label(pool: &SqlitePool, id: i64) -> Result<Option<IssueLabel>, sqlx::Error> {
    sqlx::query_as::<_, IssueLabel>("SELECT * FROM issue_labels WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_label(
    pool: &SqlitePool,
    input: NewIssueLabel,
) -> Result<IssueLabel, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO issue_labels (name, color, icon) VALUES (?, ?, ?)",
    )
    .bind(&input.name)
    .bind(&input.color)
    .bind(&input.icon)
    .execute(pool)
    .await?;

    get_label(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn update_label(
    pool: &SqlitePool,
    id: i64,
    input: UpdateIssueLabel,
) -> Result<Option<IssueLabel>, sqlx::Error> {
    sqlx::query(
        "UPDATE issue_labels SET
            name  = COALESCE(?, name),
            color = COALESCE(?, color),
            icon  = COALESCE(?, icon)
         WHERE id = ?",
    )
    .bind(input.name)
    .bind(input.color)
    .bind(input.icon)
    .bind(id)
    .execute(pool)
    .await?;

    get_label(pool, id).await
}

pub async fn delete_label(pool: &SqlitePool, id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM issue_labels WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}
