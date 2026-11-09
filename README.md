# basis

**Where did this number come from?** Civil engineers often need a drawing, a client brief and a design standard to check a single value. basis brings those documents into one project workspace. Ask a question about the project, then select a citation to see the passage or table row highlighted in the original PDF.

[Open basis](https://streichholzschachtel.vercel.app/#projects)

Built for natHacks 2026 by team Streichholzschachtel.

## Try a design review

1. **Ask a live question.** Open **Parkview Exchange Redevelopment → New query**, enter “How long is sanitary pipe S1?” and select **Search**. Click the citation beside the answer to verify the **43 m** length in the project’s model register.
2. **Check a finding across three documents.** Open **North Ridge Highway Intersection Upgrade**. Under **Potential issues**, expand **Crest sight distance is below the screening value** and select **Inspect evidence**. In the first paragraph, click citation **2** for the drawing’s **165 m** sight distance, **1** for the provincial guide’s **185 m** level-road value at 100 km/h, and **3** for the owner’s adoption of that value. The **20 m** difference gives the engineer a reason to check the survey and road grade.

The built-in projects pair synthetic design records with published standards. The North Ridge review is prepared and can be reopened immediately. New queries run on the backend workstation and search only the active project’s files. The hosted app requires that workstation and its HTTPS tunnel to be online.

## Run locally

On Windows, download the repository, install **Node.js 24 or newer**, and run these commands from the repository root:

```powershell
npm ci
npm ci --prefix backend
```

Double-click **Start basis.cmd** and choose **5** to open the workspace. The [backend guide](https://github.com/matveho/Streichholzschachtel/blob/main/backend/README.md) covers PDF extraction and table reading. The [project source notes](https://github.com/matveho/Streichholzschachtel/blob/main/backend/demo/PROJECT-PACKAGES.md) document the engineering assumptions and the evidence behind the prepared findings.
