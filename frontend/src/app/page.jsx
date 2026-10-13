import { Clock } from "@/components/clock";
import { DashboardFrame } from "@/components/dashboard-frame";
import { GitHubTrending } from "@/components/github-trending";
import { LiveTicker } from "@/components/live-ticker";
import { NewsDigest, WorldNews } from "@/components/news";
import { QuickLinks } from "@/components/quick-links";
import { TaskBoard } from "@/components/task-board";
export default function Home() {
    return (<DashboardFrame>
      <section className="welcome" aria-label="Your workspace">
        <div>
          <p className="eyebrow"><span className="status-dot"/> A LITTLE SPACE TO THINK</p>
          <h1>Less noise.<br /><span>More flow.</span></h1>
          <p className="welcome-copy">A quiet corner of the internet. Make something good.</p>
        </div>
        <Clock />
      </section>
      <LiveTicker />
      <div className="dashboard-grid">
        <NewsDigest />
        <GitHubTrending />
        <TaskBoard />
        <WorldNews />
        <QuickLinks />
      </div>
    </DashboardFrame>);
}
