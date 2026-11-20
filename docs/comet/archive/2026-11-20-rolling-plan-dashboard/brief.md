# Outcome

Give the Rolling Plan project a saved dashboard for daily task follow-up using the existing dashboard settings.

# Scope

Create one project dashboard named 任务跟进 in Rolling Plan (`pocoy.ROLL`). Put four count widgets at the top for 待确认, 未开始, 临期处理中, and 已超期. Put the overdue and near-due work-item lists below the counts, followed by the project's status breakdown and a full-width 活跃度 heatmap. Each list shows up to ten matching work items, with the most recently updated first and a link to the work item.

临期处理中 matches the existing 进行中（3日内到期） and 进行中（5日内到期） columns. 已超期 matches the existing 已超期 column. Counts and lists use the same status filters. The breakdown groups work items by all seven project status columns. Work-item counts can include both parent and child items.

Keep the built-in activity heatmap settings from Overview. It shows activity across the whole project, grouped by day. The built-in Overview remains available as its own tab. Apply the change through the existing dashboard connector. Verify the saved layout by reading it back, compare the status filters with the current issue list, and check that the project's daily activity endpoint returns data.

## Directory structure

### Created

- It’s a Plan → 滚动计划 → Dashboards → 任务跟进. One saved project configuration with eight widgets.

# Non-goals

- Application source code, issue records, and project workflows.
- Relative due-date calculations, weighted progress, or historical completion trends.

# Acceptance examples

- Rolling Plan has exactly one saved dashboard named 任务跟进 with its own tab. The built-in Overview remains available.
- The first row has four live work-item counts with the stated status filters. The two lists below use the matching filters, show up to ten work items each in most-recently-updated order, and use the existing work-item links.
- The status breakdown shows counts grouped by project status. No issue record or project workflow configuration is edited.
- The full-width 活跃度 heatmap below the status breakdown shows project-wide activity grouped by day.
