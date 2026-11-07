# Team demo

The local interface is at **http://127.0.0.1:8787/app/#home**. It is running on this device. Double-click **Start Demo.cmd** if it needs restarting; that uses the saved demo engine and frontend snapshot on this device. On a fresh checkout without a snapshot, it uses the normal launcher. Keep the backend running during the demo.

Use Home's **Data source** selector:

- **Static data**: the five prepared engineering scenarios, with the complete curated reports and PDF interactions.
- **Matvey's backend**: real queries over the local document collection, with source citations, highlights and minimap marks. No hosted model processing is enabled.
- **Backend (main)**: the other engineer's backend, using its separately configured connection.

Verified live frontend query:

> What minimum vertical clearance is required where sewer mains cross each other?

The source provision states **300 mm**. Select its citation to open and highlight the original PDF. Another direct lookup is **What is the minimum slope for catch basin leads?**; its original provision states **1.0%**.

An unrelated query such as **What is the capital of France?** returns **No supported answer**, with no document results or citations.

The broader local synthesis work remains in progress. Some complex live queries are incomplete or withheld. Use Static data for the prepared scenarios; its reports are explicitly static, not presented as live backend output.

Authenticated HTTPS access from the deployed Basis origin and the bundled frontend flow were tested. A private remote connection link is saved in ignored `state/connection.json` under `remoteFrontend`; keep it private because it includes the connection key.
