const API_BASE_URL = window.location.hostname.includes('vercel.app')
    ? 'https://gurki309-contract-analysis-ai.hf.space'
    : ''; // Automatically uses relative paths when running locally or served directly from HuggingFace

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    lucide.createIcons();
    
    // Tab State Manager
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const tabTitle = document.getElementById('tab-title');
    const tabSubtitle = document.getElementById('tab-subtitle');
    
    const tabMetadata = {
        'analyze': {
            title: 'Contract Analyzer Sandbox',
            subtitle: 'Input contract clauses to automatically classify their legal context in real-time.'
        },
        'pdf': {
            title: 'PDF Contract Clause Parser',
            subtitle: 'Upload any contract PDF to segment, extract, and batch-classify every legal clause instantly.'
        },
        'training': {
            title: 'Model Training Configuration',
            subtitle: 'Configure neural network parameters and inspect local validation logs.'
        }
    };

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            
            // Toggle sidebar active nav class
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            // Show target panel, hide others
            tabPanels.forEach(panel => {
                if (panel.id === `tab-${targetTab}`) {
                    panel.classList.add('active');
                } else {
                    panel.classList.remove('active');
                }
            });
            
            // Update Header titles
            tabTitle.textContent = tabMetadata[targetTab].title;
            tabSubtitle.textContent = tabMetadata[targetTab].subtitle;
        });
    });

    // ------------------------------------------------------------------ //
    // Server Health Monitoring                                           //
    // ------------------------------------------------------------------ //
    const serverDot = document.getElementById('server-status-dot');
    const serverText = document.getElementById('server-status-text');
    let isModelLoaded = false;
    
    async function checkServerHealth() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/health`);
            if (res.ok) {
                const data = await res.json();
                if (data.model_loaded) {
                    serverDot.className = 'status-dot pulse-green';
                    serverText.textContent = 'Server Status: Active';
                    document.getElementById('model-badge').textContent = `v${data.version} — Loaded`;
                    isModelLoaded = true;
                } else {
                    serverDot.className = 'status-dot pulse-red';
                    serverText.textContent = 'Server Status: Training / Missing Model';
                    document.getElementById('model-badge').textContent = `v${data.version} — Model Unloaded`;
                    isModelLoaded = false;
                }
            } else {
                throw new Error('Unhealthy status code');
            }
        } catch (e) {
            serverDot.className = 'status-dot pulse-red';
            serverText.textContent = 'Server Status: Offline';
            document.getElementById('model-badge').textContent = 'Server Disconnected';
            isModelLoaded = false;
        }
    }
    
    // Poll health status immediately and every 5 seconds
    checkServerHealth();
    setInterval(checkServerHealth, 5000);

    // ------------------------------------------------------------------ //
    // Radial Confidence Gauge Renderer                                   //
    // ------------------------------------------------------------------ //
    const canvas = document.getElementById('gauge-canvas');
    
    function drawGauge(confidence) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const x = canvas.width / 2;
        const y = canvas.height / 2;
        const radius = 68;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Base track arc (dim slate)
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 10;
        ctx.stroke();
        
        // Progress active arc (glowing teal)
        ctx.beginPath();
        const endAngle = (confidence * 2 * Math.PI) - (0.5 * Math.PI);
        ctx.arc(x, y, radius, -0.5 * Math.PI, endAngle);
        ctx.strokeStyle = '#06b6d4'; // Teal
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 10;
        ctx.stroke();
        
        // Reset shadow
        ctx.shadowBlur = 0;
    }

    // ------------------------------------------------------------------ //
    // Tab: Single Clause Classifier                                      //
    // ------------------------------------------------------------------ //
    const clauseInput = document.getElementById('clause-input');
    const charCount = document.getElementById('char-count');
    const btnPredict = document.getElementById('btn-predict');
    const placeholderState = document.getElementById('predict-placeholder');
    const resultDetails = document.getElementById('predict-details');
    const categoryLabel = document.getElementById('predicted-category-label');
    const categoryDesc = document.getElementById('predicted-category-desc');
    const confPercentText = document.getElementById('confidence-percentage');
    const spinner = document.getElementById('global-spinner');
    const spinnerMsg = document.getElementById('spinner-message');
    
    // Character Counter
    clauseInput.addEventListener('input', () => {
        charCount.textContent = clauseInput.value.length.toLocaleString();
    });

    const categoryExplanations = {
        "Employment Terms": "Contains specifications relating to employment, hiring rules, work scope, or direct conditions of employment.",
        "Dispute Resolution": "Specifies how legal disputes between contract parties will be arbitrated, negotiated, or settled.",
        "Termination Clauses": "Defines rules, timelines, and conditions under which either party can legally terminate the contract agreement.",
        "Governing Law and Jurisdiction": "Establishes which country's or state's courts hold the legal authority to enforce or interpret the contract terms.",
        "Payment and Compensation": "Establishes pricing structures, invoicing schedules, compensation rates, and financial terms of work.",
        "Assignment and Transfer Restrictions": "Establishes terms limiting or regulating a party's right to transfer or delegate contract obligations to a third party.",
        "Financials and Taxes": "Covers tax responsibilities, capital commitments, reporting obligations, and accounting procedures.",
        "Liability and Damages": "Limits or establishes the scope of legal financial liability, indemnification, or damages each party is liable for.",
        "Commercial Terms": "Defines product deliveries, standard supply chain terms, operational warranties, and trade regulations.",
        "Confidentiality and Non-Disclosure": "Regulates how secret proprietary data or confidential knowledge must be handled, secured, and kept private.",
        "Compliance and Audit": "Establishes terms requiring parties to adhere to industrial audits and governmental regulations.",
        "Risk and Insurance": "Outlines allocations of risk, requirements for purchasing insurance, and loss coverage liabilities.",
        "Intellectual Property & Ownership": "Protects and handles ownership definitions for copyrights, software, patents, and designs created under work.",
        "Performance Obligations": "Outlines specific physical outputs, deliverables, and service levels a party must produce to satisfy terms.",
        "Regulatory Compliance": "Specifies compliance parameters for specialized governmental laws, regulatory standards, or environmental policies.",
        "General Clauses": "Miscellaneous clauses containing standard boilerplate terminology, declarations of full agreement, or general legal clauses."
    };

    btnPredict.addEventListener('click', async () => {
        const text = clauseInput.value.trim();
        if (text.length < 5) {
            alert('Please enter a valid clause containing at least 5 characters.');
            return;
        }
        
        if (!isModelLoaded) {
            alert('FastAPI server is loaded, but the neural model weights are still missing or training locally. Please wait a few seconds.');
            return;
        }
        
        // Show spinner overlay
        spinnerMsg.textContent = 'Running neural classifier...';
        spinner.classList.remove('hidden');
        
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            
            if (res.ok) {
                const data = await res.json();
                
                // Switch visible card states
                placeholderState.classList.add('hidden');
                resultDetails.classList.remove('hidden');
                
                // Update text categories
                categoryLabel.textContent = data.label;
                categoryDesc.textContent = categoryExplanations[data.label] || 'Categorized legal clause segment.';
                
                // Animate gauge & text values
                const confidence = data.confidence;
                confPercentText.textContent = `${Math.round(confidence * 100)}%`;
                drawGauge(confidence);
            } else {
                const error = await res.json();
                alert(`Prediction error: ${error.detail || 'Inference failure.'}`);
            }
        } catch (e) {
            alert('Failed to connect to backend inference server.');
        } finally {
            spinner.classList.add('hidden');
        }
    });

    // ------------------------------------------------------------------ //
    // Tab: PDF Contract batch analysis                                   //
    // ------------------------------------------------------------------ //
    const dropzone = document.getElementById('pdf-dropzone');
    const fileInput = document.getElementById('pdf-file-input');
    const selectedFileName = document.getElementById('selected-file-name');
    const pdfActionBar = document.getElementById('pdf-action-bar');
    const btnResetPdf = document.getElementById('btn-reset-pdf');
    const btnAnalyzePdf = document.getElementById('btn-analyze-pdf');
    const pdfReportCard = document.getElementById('pdf-report-card');
    const pdfTotalClausesBadge = document.getElementById('pdf-total-clauses');
    const pdfTbody = document.getElementById('pdf-clauses-tbody');
    
    let selectedFile = null;

    // File input handlers
    dropzone.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
        handleFileSelection(e.target.files[0]);
    });

    // Drag and drop handlers
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('active');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('active');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('active');
        handleFileSelection(e.dataTransfer.files[0]);
    });

    function handleFileSelection(file) {
        if (!file) return;
        if (file.type !== 'application/pdf') {
            alert('Only PDF files are supported for logical clause segmentation.');
            return;
        }
        
        selectedFile = file;
        selectedFileName.textContent = `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        selectedFileName.classList.remove('hidden');
        pdfActionBar.classList.remove('hidden');
    }

    btnResetPdf.addEventListener('click', () => {
        selectedFile = null;
        selectedFileName.classList.add('hidden');
        pdfActionBar.classList.add('hidden');
        fileInput.value = '';
        pdfReportCard.classList.add('hidden');
    });

    btnAnalyzePdf.addEventListener('click', async () => {
        if (!selectedFile) return;
        
        if (!isModelLoaded) {
            alert('FastAPI server is loaded, but the neural model weights are still missing or training locally. Please wait a few seconds.');
            return;
        }
        
        spinnerMsg.textContent = 'Parsing PDF text & classifying contract clauses...';
        spinner.classList.remove('hidden');
        
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/analyze-pdf`, {
                method: 'POST',
                body: formData
            });
            
            if (res.ok) {
                const data = await res.json();
                
                // Show reporting elements
                pdfReportCard.classList.remove('hidden');
                pdfTotalClausesBadge.textContent = `${data.total_clauses} Clauses Classified`;
                
                // Clear and render table rows
                pdfTbody.innerHTML = '';
                
                if (data.clauses.length === 0) {
                    pdfTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No valid clause paragraphs extracted from PDF contract.</td></tr>';
                } else {
                    data.clauses.forEach(clause => {
                        const tr = document.createElement('tr');
                        
                        // Add index cell
                        const tdIndex = document.createElement('td');
                        tdIndex.className = 'text-index';
                        tdIndex.textContent = `#${clause.index + 1}`;
                        tr.appendChild(tdIndex);
                        
                        // Add text cell (with truncated preview, full text hover)
                        const tdText = document.createElement('td');
                        tdText.className = 'clause-text-cell';
                        tdText.title = clause.text;
                        tdText.textContent = clause.text;
                        tr.appendChild(tdText);
                        
                        // Add label cell
                        const tdLabel = document.createElement('td');
                        tdLabel.className = 'label-cell';
                        tdLabel.textContent = clause.label;
                        tr.appendChild(tdLabel);
                        
                        // Add confidence cell
                        const tdConfidence = document.createElement('td');
                        tdConfidence.className = 'confidence-val';
                        tdConfidence.textContent = `${Math.round(clause.confidence * 100)}%`;
                        tr.appendChild(tdConfidence);
                        
                        pdfTbody.appendChild(tr);
                    });
                }
            } else {
                const error = await res.json();
                alert(`PDF Analysis failed: ${error.detail || 'Segmentation error.'}`);
            }
        } catch (e) {
            alert('Failed to connect to PDF parsing API endpoints.');
        } finally {
            spinner.classList.add('hidden');
        }
    });
});
