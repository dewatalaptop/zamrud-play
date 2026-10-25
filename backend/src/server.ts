import { app } from "./app";
import { installProcessHandlers } from "./lib/bugReporter";

installProcessHandlers();

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
