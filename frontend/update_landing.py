import re

with open("app/page.tsx", "r") as f:
    content = f.read()

# 1. Import LandingPage
content = content.replace('import RootGraph from "@/components/ThinkMapGraph";', 'import RootGraph from "@/components/ThinkMapGraph";\nimport LandingPage from "@/components/LandingPage";')

# 2. Update view state
content = content.replace('const [view, setView] = useState<"home"|"graph"|"dashboard"|"quiz">("home");', 'const [view, setView] = useState<"landing"|"home"|"graph"|"dashboard"|"quiz">("landing");')

# 3. Hide header
# Find header start and end
content = re.sub(r'      \{\/\* ── Header ── \*\/}\n      <header.*?</header>', lambda m: f'      {{/* ── Header ── */}}\n      {{view !== "landing" && (\n  {m.group(0).replace(chr(10), chr(10)+"  ")}\n      )}}', content, flags=re.DOTALL)

# 4. Render LandingPage
content = content.replace('      {/* ── Quiz View ── */}', '      {/* ── Landing View ── */}\n      {view === "landing" && <LandingPage onLaunch={() => setView("home")} />}\n\n      {/* ── Quiz View ── */}')

with open("app/page.tsx", "w") as f:
    f.write(content)
