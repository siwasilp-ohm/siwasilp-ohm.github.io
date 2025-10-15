// Function to save image with custom filename
function saveImage(canvas, defaultPrefix) {
    // Create a modal for filename input
    const modal = document.createElement('div');
    modal.className = 'filename-modal';
    
    // Get current date and time for default filename
    const now = new Date();
    const timestamp = now.getFullYear() + 
                     ('0' + (now.getMonth() + 1)).slice(-2) + 
                     ('0' + now.getDate()).slice(-2) + '_' + 
                     ('0' + now.getHours()).slice(-2) + 
                     ('0' + now.getMinutes()).slice(-2) + 
                     ('0' + now.getSeconds()).slice(-2);
    
    const defaultFilename = `${defaultPrefix}_${timestamp}`;
    
    // Create modal content
    modal.innerHTML = `
        <div class="filename-modal-content">
            <h3>บันทึกภาพ</h3>
            <div class="filename-input-container">
                <label for="filename">ชื่อไฟล์:</label>
                <input type="text" id="filename" value="${defaultFilename}" placeholder="ชื่อไฟล์">
                <span>.png</span>
            </div>
            <div class="filename-modal-buttons">
                <button id="cancelSave">ยกเลิก</button>
                <button id="confirmSave">บันทึก</button>
            </div>
        </div>
    `;
    
    // Add modal to body
    document.body.appendChild(modal);
    
    // Focus on the input field
    setTimeout(() => {
        const input = document.getElementById('filename');
        if (input) {
            input.focus();
            input.select();
        }
    }, 100);
    
    // Add event listeners
    document.getElementById('cancelSave').addEventListener('click', function() {
        document.body.removeChild(modal);
    });
    
    document.getElementById('confirmSave').addEventListener('click', function() {
        const filename = document.getElementById('filename').value || defaultFilename;
        
        // Create a download link
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        // Remove modal
        document.body.removeChild(modal);
    });
    
    // Allow pressing Enter to confirm
    document.getElementById('filename').addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            document.getElementById('confirmSave').click();
        }
    });
}