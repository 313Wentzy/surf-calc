<?php
/*
Template Name: Desktop App Testing
*/
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="">
    <meta name="author" content="">
    <title>Drop calculator Testing</title>
    <link href="<?php echo get_template_directory_uri(); ?>/bootstrap_theme/bootstrap.css" rel="stylesheet" type="text/css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.7.1/dist/leaflet.css" />
    <script src="https://cdn.jsdelivr.net/npm/leaflet@1.7.1/dist/leaflet.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/leaflet-polylinedecorator@1.6.0/dist/leaflet.polylineDecorator.js"></script>
    <script src="https://github.com/bbecquet/Leaflet.RotatedMarker/blob/master/leaflet.rotatedMarker.js"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet.markercluster/dist/MarkerCluster.Default.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet.markercluster/dist/MarkerCluster.css" />
    <script src="https://cdn.jsdelivr.net/npm/leaflet.markercluster/dist/leaflet.markercluster.js"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet-draw/dist/leaflet.draw.css" />

    <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>

    <script src="https://cdn.jsdelivr.net/npm/leaflet-draw/dist/leaflet.draw.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">

    <link rel="stylesheet" href="<?php echo get_template_directory_uri(); ?>/blocks.css">
    <link rel="stylesheet" href="<?php echo get_template_directory_uri(); ?>/style-calculator-desktop-app.css?v=1.40"> <script>
        const templateDirectoryUri = '<?php echo get_template_directory_uri(); ?>';
    </script>
  <style>
    /* Report FAB + Modal (minimal) */
    .report-fab{position:fixed;left:16px;bottom:16px;z-index:10050;border:none;border-radius:999px;padding:12px 16px;background:#ff5757;color:#fff;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.25);cursor:pointer}
    .report-fab:hover{filter:brightness(0.95)}
    .report-modal{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:10040}
    .report-modal.open{display:flex}
    .report-modal__dialog{width:min(520px,calc(100% - 32px));background:#0a1018;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:16px;color:#fff}
    .report-modal__dialog h3{margin:0 0 8px 0;font-size:18px}
    #reportDropReason{width:100%;resize:vertical;min-height:80px;background:#0f1722;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:8px}
    .report-modal__actions{margin-top:12px;display:flex;gap:8px;justify-content:flex-end}
    .btn-primary2{background:#2f80ed;border:none;color:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}
    .btn-secondary2{background:transparent;border:1px solid rgba(255,255,255,.18);color:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}
  </style>
  </head>
<body>
    <?php
        include(get_template_directory() . '/index.html');
    ?>
        <div class="bg-light header_top py-1">
            <img src="<?php echo get_template_directory_uri(); ?>/imgs/logologotype_300x919px_new2.png" alt="dropmazter logotype" width="10%" style="left: 3%;position: absolute;width: 150px;">
            <div class="text-primary-group"><a class="fw-normal h5 text-primary text-white" href="https://dropmazter.com/"
                style="text-decoration: none;" onmouseover="this.className='fw-bold h5 text-primary text-white'"
                onmouseout="this.className='fw-normal h5 text-primary text-white'">Home</a>
                <a class="fw-normal h5 text-primary text-white" href="https://dropmazter.com/map/"
                style="text-decoration: none;" onmouseover="this.className='fw-bold h5 text-primary text-white'"
                onmouseout="this.className='fw-normal h5 text-primary text-white'">Map</a>
                <a class="fw-bold h5 text-primary text-white" style="text-decoration: none;"
                    href="https://dropmazter.com/calculator">Drop
                    Calculator</a>
            <a class="fw-normal h5 text-primary text-white" href="https://dropmazter.com/articles/"
                style="text-decoration: none;" onmouseover="this.className='fw-bold h5 text-primary text-white'"
                onmouseout="this.className='fw-normal h5 text-primary text-white'">Articles</a>
        </div>
    </div>

     <!-- Desktop Icon (Floating Action Button) -->
    <div id="desktop-icon" class="desktop-icon">
        <i class="fas fa-desktop"></i>
    </div>

    <!-- Agent Desktop Window -->
    <div id="agent-window" class="agent-window" style="display: none;">
        <!-- Window Header -->
        <div class="window-header">
            <div class="window-title">
                <i class="fas fa-desktop"></i>
                <span>Desktop Agent</span>
                <div id="ws-status" class="status-indicator disconnected">
                    <span class="status-dot"></span>
                    <span class="status-text">Disconnected</span>
                </div>
            </div>
            <button class="window-close" id="btnCloseWindow">
                <i class="fas fa-times"></i>
            </button>
        </div>
        
        <!-- Window Content -->
        <div class="window-content">
            <!-- Left Panel -->
            <div class="window-left-panel">
                <!-- Connection Section -->
                <div class="control-section">
                    <h4>Connection</h4>
                    <div class="button-row">
                        <button id="btnConnect" class="agent-btn">Connect</button>
                        <button id="btnLaunchApp" class="agent-btn" disabled>Launch Agent</button>
                        <button id="btnRefresh" class="agent-btn">Refresh</button>
                    </div>
                </div>
                
                <!-- Monitor Section -->
                <div class="control-section">
                    <h4>Monitors</h4>
                    <select id="selMonitors" class="agent-select">
                        <option value="">-- No Monitors --</option>
                    </select>
                    <div class="button-row">
                        <button id="btnRefreshMonitors" class="agent-btn">Refresh</button>
                        <button id="btnSetMonitor" class="agent-btn">Set</button>
                        <button id="btnCapture" class="agent-btn">Capture</button>
                    </div>
                </div>
            </div>
            
            <!-- Right Panel - Activity Log -->
            <div class="window-right-panel">
                <h4>Activity Log</h4>
                <div id="log" class="log-area"></div>
            </div>
        </div>
        
        <!-- Resize Handle -->
        <div class="window-resize-handle"></div>
    </div>

    <!-- Notification Toast Container -->
    <div id="notification-container" class="notification-container"></div>

    <!-- Auth Modal (Google Antigravity Style) -->
    <div id="auth-modal" class="auth-modal-overlay">
        <div class="auth-modal">
            <div class="auth-modal-header">
                <h2>🚀 Open Desktop Agent</h2>
                <button class="auth-modal-close" id="btnCloseModal">&times;</button>
            </div>
            <div class="auth-modal-body">
                <p>https://localhost:30123 wants to open this application.</p>
                <div class="auth-modal-info">
                    <label>
                        <input type="checkbox" id="chkAllowAlways">
                        Always allow localhost to open links of this type in the associated app
                    </label>
                </div>
            </div>
            <div class="auth-modal-footer">
                <button id="btnModalOpen" class="auth-btn-primary">Open Desktop Agent</button>
                <button id="btnModalCancel" class="auth-btn-secondary">Cancel</button>
            </div>
        </div>
    </div>

    <div id="floating-slider-container">
        <div id="floating-slider-track">
            <div id="floating-slider-toggle"></div>
            <div class="floating-slider-option floating-slider-option-1"></div>
            <div class="floating-slider-option floating-slider-option-2"></div>
            <div class="floating-slider-option floating-slider-option-3"></div>
            <div class="floating-slider-option floating-slider-option-4"></div>
        </div>
    </div>


    </div>
    <div class="align-items-center bg-dark d-flex p-2 position-fixed routes-sidebar text-white" style="flex-direction: column-reverse; display: flex; justify-content: center; left: 0%; border-top-right-radius: 10px; border-bottom-right-radius: 10px;

/* transform: translateY(-50%) */">
        <button class="btn fw-semibold" id="resetButton"
        style="background-color: ffe68d; border-radius: 8px; color: #0a1018;" data-bs-toggle="tooltip" title="Clears destination marker and bus route. Right-clicking the mouse does the same.">Reset</button>
        </div>
        <button type="button" id="solveButton" class="btn btn-lg btn-primary calculate-button text-dark">Solve Drop</button>
        <div class="modal pg-show-modal fade custom-modal-width" id="tutorialmodal" tabindex="-1" aria-labelledby="SaveDrop" aria-hidden="true">
            <div class="modal-dialog">
                <div class="bg-dark modal-content">
                    <div class="bg-dark modal-header" style="padding-bottom:5px;">
                        <h5 class="modal-title text-white" id="SaveDrop">Drop Calculator Tutorial</h5>
                        <button type="button" class="bg-white btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="bg-dark modal-body" style="padding-top:5px;">
                        <p class="text-white-50" style="margin-bottom:0%;"><b>Hints</b>: </p>
                        <ul>
                            <li class="text-white-50">Be sure to take full advantage of the menu to the left side of the screen!</li>
                            <li class="text-white-50">Right click at any time to reset dropspot marker!</li>
                            <li class="text-white-50">You can move both dropspot and bus route by dragging the markers around!</li>
                        </ul>                         
                        <form>
                            <div class="container">
                                <div class="row">
                                    <div class="col-md-4">
                                        <h2 class="text-white">Step 1</h2>
                                        <p class="text-white" style="margin-bottom:5px;">Select a dropspot by clicking anywhere on the map.</p>
                                        <p class="text-white-50"><b>Hint</b>: Enable some chests and click on one to perfectly select it!</p>
                                        <img src="<?php echo get_template_directory_uri(); ?>/imgs/guide-step1.png" class="img-fluid d-block mx-auto" alt="Step 1 Image">
                                    </div>
                                    <div class="col-md-4">
                                        <h2 class="text-white">Step 2</h2>
                                        <p class="text-white" style="margin-bottom:5px;">Select the bus route by clicking on the start and end of the route</p>
                                        <p class="text-white-50"><b>Hint</b>: Line it up using landmarks to get a perfect drop!</p>
                                        <img src="<?php echo get_template_directory_uri(); ?>/imgs/guide-step2.png" class="img-fluid d-block mx-auto" alt="Step 2 Image">
                                    </div>
                                    <div class="col-md-4">
                                        <h2 class="text-white">Step 3</h2>
                                        <p class="text-white" style="margin-bottom:5px;">Press the solve button to mathematically get the fastest drop.</p>
                                        <p class="text-white-50"><b>Hint</b>: You can use the enter key instead of pressing the solve button!</p>
                                        <img src="<?php echo get_template_directory_uri(); ?>/imgs/guide-step3.png" class="img-fluid d-block mx-auto" alt="Step 3 Image">
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="bg-dark modal-footer">
                        <button type="button" class="btn btn-light" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>

    <div id="map">
    </div>


    <nav id="nav" class="nav">
        <div id="nav_icon" class="nav_icon">
            <svg class="shape_container top">
            </svg><span>MENU</span> <i class="fas fa-angle-left"></i>
            <svg class="shape_container bottom">
            </svg>
        </div>
    </nav>
    <div id="sidebar" class="sidebar-closed">
        <div class="sidebar-content scrollable-content">
            <button id="toggle" class="float-end">Close</button>
            <h3 class="sidebar-header" style="margin-top: 5px;">Drop Analysis</h3>
            <div class="bg-dark card">
                <div class="card-front card-hover-effect">
                    <div class="layer">
                        <div class="container">
                            <div class="corner"></div>
                            <h5 class="fw-bold text-center text-uppercase">
                                Chest Spawns
                            </h5>

                            <div
                                style="display: flex; gap: 10px; justify-content: center; padding-bottom: 5px; flex-wrap: nowrap;">

                                <label class="checkbox-label info-box-hover-effect" for="vbtn-checkbox1">
                                    <img src="<?php echo get_template_directory_uri(); ?>/imgs/chest.png" width="30" height="30" alt="Chest Icon"
                                        style="user-select: none; pointer-events: none;">
                                    <span
                                        style="font-size: 0.9rem; white-space: nowrap; user-select: none;">Regular</span>
                                    <div class="custom-checkbox">
                                        <input type="checkbox" id="vbtn-checkbox1">
                                        <span class="checkbox-visual"></span>
                                    </div>
                                </label>

                                <label class="checkbox-label info-box-hover-effect" for="vbtn-checkbox2">
                                    <img src="<?php echo get_template_directory_uri(); ?>/imgs/other_chest.png" width="30" height="30" alt="Other Chest Icon"
                                        style="user-select: none; pointer-events: none;">
                                    <span
                                        style="font-size: 0.9rem; white-space: nowrap; user-select: none;">Other</span>
                                    <div class="custom-checkbox">
                                        <input type="checkbox" id="vbtn-checkbox2">
                                        <span class="checkbox-visual"></span>
                                    </div>
                                </label>

                            </div>
                        </div>
                        <div class="corner"></div>
                        <div class="corner"></div>
                        <div class="corner"></div>
                    </div>
                </div>

                <div class="card-front card-hover-effect">
                    <div class="layer">
                        <div class="container">
                            <div class="corner"></div>
                            <div class="container pb-1" style="padding-top: 5px !important;">
                                <div class="align-items-center row" style="display: flex;justify-content: center;">
                                    <div class="col-auto">
                                        <h5 class="fw-bold mb-0 text-center text-uppercase" data-bs-toggle="tooltip"
                                            title="Adjust the destination height to land, e.g., under a roof or bridge.">
                                            Height Adjustment<a class="fw-lighter text-decoration-none"
                                                style="color: #577BFE;"> 🛈</a></h5>
                                    </div>
                                    <div class="slider-container">
                                        <input type="range" id="slider1" class="custom-slider" min="-15.36" max="15.36"
                                            step="1.92" value="0"> <input type="range" id="slider2" class="custom-slider2" min="-15.36" max="15.36"
                                            step="1.92" value="0"> <input type="range" id="slider3" class="custom-slider3" min="-15.36" max="15.36"
                                            step="1.92" value="0"> <input type="range" id="slider4" class="custom-slider4" min="-15.36" max="15.36"
                                            step="1.92" value="0"> <div class="slider-marks" id="slider-marks"></div>

                                    </div>
                                    <div
                                        class="align-items-center container d-flex gap-2 justify-content-center text-center">
                                        <input type="height_number" id="manual1" step="0.01" value="0.00">
                                        <input type="height_number2" id="manual2" step="0.01" value="0.00">
                                        <input type="height_number3" id="manual3" step="0.01" value="0.00">
                                        <input type="height_number4" id="manual4" step="0.01" value="0.00">
                                    </div>

                                    <p class=" fw-normal" style="
                                        right: 10px;
                                        text-align: end;
                                        color: #cccccc;
                                        margin-bottom: 0px;
                                        ">1 Tile = 1 Wall</p>
                                </div>

                            </div>
                        </div>
                        <div class="corner"></div>
                        <div class="corner"></div>
                        <div class="corner"></div>
                    </div>
                </div>

                <div class="card-front card-hover-effect">
                    <div class="layer">
                        <div class="container">
                            <div class="corner"></div>
                            <h5 class="fw-bold mb-0 text-uppercase text-center" style="padding-top:5px;">
                                Drop Profile
                            </h5>
                            <p class="fw-light text-center" style="margin-bottom:5px; color: #cccccc">
                                Follow this path to land perfectly
                            </p>
                            <div class="chart-wrapper">
                                <canvas id="flightChart"></canvas>
                            </div>
                        </div>
                        <div class="corner"></div>
                        <div class="corner"></div>
                        <div class="corner"></div>
                    </div>
                </div>

                <div class="card-front card-hover-effect">
                    <div class="layer">
                        <div class="container">
                            <div class="corner"></div>
                            <h5 class="fw-bold text-uppercase text-center" style="padding-top: 5px;">Drop Info
                            </h5>

                            <div class="flight-info-grid"
                                style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; padding: 0 10px 15px 10px;">

                                <div class="info-item info-box-hover-effect">
                                    <div class="info-label">
                                        Deploy Height</div>
                                    <div class="info-value" id="deployHeight">--</div>
                                </div>

                                <div class="info-item info-box-hover-effect">
                                    <div class="info-label">
                                        Total ETA</div>
                                    <div class="info-value" id="totalEta">--</div>
                                </div>

                                <div class="info-item info-box-hover-effect">
                                    <div class="info-label">
                                        To Deploy Point</div>
                                    <div class="info-value" id="etaDeployPoint">--</div>
                                </div>

                                <div class="info-item info-box-hover-effect">
                                    <div class="info-label">
                                        Glide to Destination</div>
                                    <div class="info-value" id="glideTime">--</div>
                                </div>

                            </div>
                        </div>
                        <div class="corner"></div>
                        <div class="corner"></div>
                        <div class="corner"></div>
                    </div>
                </div>


                <div class="card-front card-hover-effect">
                    <div class="layer">
                        <div class="container">
                            <div class="corner"></div>
                            <h5 class="fw-bold mb-0 text-uppercase text-center" style="padding-top:10px;">
                                Bus Jump
                            </h5>

                            <div class="row" id="image-row"
                                style="padding-top: 5%; padding-bottom: 5%; justify-content: center;">
                                <div id="imageContainer" style="position: relative;">
                                    <img id="bus" class="busimg" src="<?php echo get_template_directory_uri(); ?>/imgs/analysis_placeholder_bus.png" width="200"
                                        height="200" class="flex-row">
                                    </div>
                            </div>
                        </div>
                        <div class="corner"></div>
                        <div class="corner"></div>
                        <div class="corner"></div>
                    </div>
                </div>

                <div class="card-front card-hover-effect" style="margin-bottom: 20px;">
                    <div class="layer">
                        <div class="container">
                            <div class="corner"></div>
                            <h5 class="fw-bold mb-0 text-uppercase text-center" style="padding-top:10px;">
                                Deploy Point
                            </h5>

                            <div class="row" id="image-row"
                                style="padding-top: 5%; padding-bottom: 5%; justify-content: center;">
                                <div id="imageContainer" style="position: relative;">
                                    <img id="deploy" class="deployimg" src="<?php echo get_template_directory_uri(); ?>/imgs/analysis_placeholder_deploy.png"
                                        width="200" height="200" class="flex-row">
                                    </div>
                            </div>
                        </div>
                        <div class="corner"></div>
                        <div class="corner"></div>
                        <div class="corner"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <script src="<?php echo get_template_directory_uri(); ?>/map-script-desktop-app.js?v=1.51"></script> </body>
</html>