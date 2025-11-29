<?php
/*
Template Name: Surf Calc
*/

// Force authentication using WordPress' built-in login flow.
if ( ! is_user_logged_in() ) {
    auth_redirect();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Surf Calc – Under Construction</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="<?php echo get_template_directory_uri(); ?>/style-calculator-desktop-app.css?v=2.0">
</head>
<body class="surf-calc-page">
    <div class="surf-shell">
        <header class="surf-header">
            <div class="brand">
                <img src="<?php echo get_template_directory_uri(); ?>/imgs/logologotype_300x919px_new2.png" alt="Dropmazter" class="brand-logo">
                <div class="brand-meta">
                    <span class="eyebrow">Surf Calc Preview</span>
                    <h1>We&apos;re crafting a new drop calculator</h1>
                    <p>Thanks for signing in. You&apos;re early, so enjoy the sneak peek while we finish the experience.</p>
                </div>
            </div>
            <div class="cta">
                <a class="cta-btn" href="https://dropmazter.com/surf-calc">Stay on Surf Calc</a>
                <a class="link" href="<?php echo wp_logout_url( home_url('/surf-calc') ); ?>">Logout</a>
            </div>
        </header>

        <main class="surf-grid">
            <section class="hero-panel">
                <div class="overlay"></div>
                <div class="hero-copy">
                    <p class="eyebrow">Under Construction</p>
                    <h2>Hold tight—your perfect surf drop tools are on the way.</h2>
                    <p class="lede">We&apos;re polishing the flight paths, dialing in the math, and loading in new maps. You&apos;ll be the first to try it when we launch.</p>
                    <div class="badge-row">
                        <span class="badge">Early Access</span>
                        <span class="badge">Account Required</span>
                        <span class="badge">Live Preview</span>
                    </div>
                </div>
                <div class="hero-visual">
                    <div class="mock-calc">
                        <div class="mock-calc__header">
                            <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                            <div class="mock-title">Surf Drop Planner</div>
                        </div>
                        <div class="mock-calc__body">
                            <div class="mock-row">
                                <div class="label">Launch Altitude</div>
                                <div class="value">7,400 m</div>
                            </div>
                            <div class="mock-row">
                                <div class="label">Glide Time</div>
                                <div class="value">00:21</div>
                            </div>
                            <div class="mock-row">
                                <div class="label">Bus Angle</div>
                                <div class="value">38°</div>
                            </div>
                            <div class="mock-row highlight">
                                <div class="label">Estimated Landing ETA</div>
                                <div class="value">00:43</div>
                            </div>
                            <div class="progress-wrap">
                                <div class="progress"><div class="progress-bar"></div></div>
                                <div class="progress-meta">
                                    <span>Deploy</span>
                                    <span>Glide</span>
                                    <span>Land</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section class="waiting-panel">
                <div class="panel-header">
                    <div>
                        <p class="eyebrow">Live Lobby</p>
                        <h3>Players waiting with you</h3>
                        <p class="muted">We&apos;re matching your enthusiasm. Enjoy the ambient drop while we finalize the release.</p>
                    </div>
                    <div class="counter">
                        <div id="wait-count" class="counter-value">0</div>
                        <div class="counter-label">surfers online</div>
                    </div>
                </div>
                <div class="sky" aria-hidden="true"></div>
                <div class="ticker">
                    <div class="ticker-track" id="ticker-track"></div>
                </div>
            </section>
        </main>

        <footer class="surf-footer">
            <div>
                <p class="muted">Dropmazter Surf Calc is almost here. Keep this tab open—we&apos;ll refresh when the calculator is live.</p>
                <a class="link" href="https://dropmazter.com" target="_blank" rel="noreferrer">Back to Home</a>
            </div>
            <button class="cta-btn ghost" id="notify-btn" type="button">Notify me on launch</button>
        </footer>
    </div>

    <div id="notify-toast" class="notify-toast" role="status" aria-live="polite">We&apos;ll ping you the moment Surf Calc is ready.</div>

    <script>
        const templateDirectoryUri = '<?php echo get_template_directory_uri(); ?>';
    </script>
    <script src="<?php echo get_template_directory_uri(); ?>/map-script-desktop-app.js?v=2.0"></script>
</body>
</html>
