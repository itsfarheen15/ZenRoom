import { Clock } from "@/components/clock";
import { DashboardFrame } from "@/components/dashboard-frame";
import { GitHubTrending } from "@/components/github-trending";
import { LiveTicker } from "@/components/live-ticker";
import { NewsDigest, WorldNews } from "@/components/news";
import { QuickLinks } from "@/components/quick-links";
import { TaskBoard } from "@/components/task-board";
import { Weather } from "@/components/weather";

/**
 * Main Developer Zen Room page.
 *
 * Layout hierarchy:
 * - `DashboardFrame`: Root wrapper providing theme provider, ambient canvas,
 *   header navigation, session modal, and motion accessibility configuration.
 * - `.welcome`: Hero section pairing quiet typography with ambient time & weather.
 * - `LiveTicker`: Marquee ticker broadcasting headlines and status announcements.
 * - `.dashboard-grid`: Pure CSS grid (responsive across mobile, tablet, and desktop)
 *   arranging the primary developer widgets without layout-shifting library bloat.
 */
export default function Home() {
    return (
        <DashboardFrame>
            <section className="welcome" aria-label="Your workspace">
                <div>
                    <p className="eyebrow"><span className="status-dot" /> A LITTLE SPACE TO THINK</p>
                    <h1>Less noise.<br /><span>More flow.</span></h1>
                    <p className="welcome-copy">A quiet corner of the internet. Make something good.</p>
                </div>
                {/* Weather widget sits parallel to the clock on wide screens, stacked on small */}
                <div className="time-weather"><Clock /><Weather /></div>
            </section>
            <LiveTicker />
            <div className="dashboard-grid">
                <NewsDigest />
                <GitHubTrending />
                <TaskBoard />
                <WorldNews />
                <QuickLinks />
            </div>
        </DashboardFrame>
    );
}
