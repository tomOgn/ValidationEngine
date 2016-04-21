(function()
{
    var DocSource, DocType, DocName;
    var firstLoad = true;
    
    $("#tabs").tabs();
    
    function setButtonStatus(status)
    {
        switch (status) 
        {
            case 'success':
            $('#button-upload').attr('class', 'btn btn-success');
            $('.failure-facade').hide();
            $('.loading-spokes').hide();
            $('.upload-facade').hide();
            $('.success-facade').show();
            break;
            case 'failure':
            $('#button-upload').attr('class', 'btn btn-danger');
            $('.upload-facade').hide();
            $('.success-facade').hide();
            $('.loading-spokes').hide();
            $('.failure-facade').show();
            break;
            case 'loading':
            $('#button-upload').attr('class', 'btn btn-primary');
            $('.success-facade').hide();
            $('.failure-facade').hide();
            $('.upload-facade').hide();
            $('.loading-spokes').show();
            break;
            case 'ready':
            $('#button-upload').attr('class', 'btn btn-primary');
            $('.success-facade').hide();
            $('.failure-facade').hide();
            $('.loading-spokes').hide();
            $('.upload-facade').show();
            break;
        }
    }

    // File input handler.
    var handleFileInput = function(e)
    {
        setButtonStatus('ready');
        
        // Admit only docx, xml, rar and zip files.
        var file = e.target.files[0];
        if (!(file.type.match("application/xml") || 
            file.type.match("text/xml") ||
            file.type.match("application/vnd.openxmlformats-officedocument.wordprocessingml.document") ||
            file.type.match("application/zip, application/octet-stream")))
        {
            var extension = this.value.match(/\.(.+)$/)[1];
            if (extension == 'docx')
                DocType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            else if (extension == 'zip')
                DocType = "application/zip, application/octet-stream";
            else
            {
                $('#button-upload').hide();
                return;
            }  
        }         
        
        // Load the file.  
        var reader = new FileReader();
        reader.onload = (function(f)
        {
            return function(e)
            {
                DocSource = e.target.result;
                DocName = f.name;
                if (f.type)
                    DocType = f.type;
                $('#button-upload').show();
            };
        })(file);
        reader.readAsDataURL(file);
    };
    
    // Callback for successful upload.
    var successfulUpload = function(response)
    {
        var table = $('#ruleSetsTable');
        table.DataTable(
        {
            data: response,
            columns: [
                { title: "Target" },
                { title: "Name" },
                { title: "Description" }
            ]
        });
        table.DataTable().rows().select();
        
        if (firstLoad)
        {
            $('#ruleSetsTable tbody').on( 'click', 'tr', function ()
            {
                $(this).toggleClass('selected');
                var table = $('#ruleSetsTable').DataTable();
                var numRows = table.rows('.selected').data().length;
                if (numRows > 0)
                    $('#button-validate').show();
                else
                    $('#button-validate').hide();
            }); 
            firstLoad = false;
        }
        
        setButtonStatus('success'); 
        $("#container1").addClass("disabledDiv");
        $('#container-rules').show();
        if (response.length > 0)
            $('#button-validate').show();
        else
            $('#button-validate').hide();
    };
    
    // Callback for unsuccessful upload.
    var notSuccessfulUpload = function(xhr, status, err)
    {
        setButtonStatus('failure');
        alert(err);
    };

    var uploadFile = function(e)
    {
        // Check if the document has been selected.
        var submitted = $('#button-upload').attr('class').indexOf('success') != -1;
        if (!DocSource || !DocType || submitted)
            return;
        
        setButtonStatus('loading');
        
        // Upload the document.
        $.ajax({
            type: 'POST',
            url: '/upload',
            data: {
                DocData: DocSource,
                DocType: DocType,
                DocName: DocName
            },
            success: successfulUpload,
            error: notSuccessfulUpload
        });
    };
    
    function populateViews(response)
    {
        // Populate the analytical view.
        var data = [];
        var results = response.AnalyticalData.Results;
        for (var i = 0; i < results.length; i++)
            data.push(
                [
                    results[i].Document, 
                    results[i].Rule,
                    results[i].Index,
                    results[i].Value,
                    results[i].Passed
                ]);

        $('#analyticalTable').DataTable(
        {
            data: data,
            columns: [
                { title: "Document" },
                { title: "Rule" },
                { title: "Element Index" },
                { title: "Element Value" },
                { title: "Passed" }
            ]
        }); 
        
        // Populate the syntetical view.
        data = [];
        results = response.SyntheticalData.Results;
        for (var i = 0; i < results.length; i++)
            data.push(
                [
                    results[i].Document, 
                    results[i].Rule,
                    results[i].Total,
                    results[i].Failed
                ]);    
                    
        $('#syntheticalTable').DataTable(
        {
            data: data,
            columns: [
                { title: "Document" },
                { title: "Rule" },
                { title: "Matches" },
                { title: "Failed" }
            ]
        });
    }
    
    // Callback for successful validation.
    function validationSuccess(response)
    {
        populateViews(response);

        $("#container-rules").addClass("disabledDiv");
        $('#container-results').show();
    }
    
    // Validate the document against the selected rules.
    function validateDocument()
    {
        // Get the selected rules.
        var table = $('#ruleSetsTable').DataTable();
        var selectedRows = table.rows('.selected').data();
        var rules = [];
        for (var i = 0; i < selectedRows.length; i++)
            rules.push(selectedRows[i][1]);
        
        // Perform the validation and get the results.
        $.ajax({
            async: false,
            type: 'POST',
            url: '/validation',
            data: { Rules: rules },
            success: validationSuccess,
            error: function(xhr, status, err) { alert(err); }
        });
    }
    
    $('#file-input').change(handleFileInput);
    $('#button-upload').click(uploadFile);
    $('#button-validate').click(validateDocument);
    $('#button-download-SyntheticalView').click(function() { window.open('/downloadSyntheticalView'); });
    $('#button-download-AnalyticalView').click(function() { window.open('/downloadAnalyticalView'); });
    $('#close1').click(function()
    {
        $('#container-rules').hide();
        $('#ruleSetsTable').dataTable().fnDestroy();
        setButtonStatus('ready');
        $("#container1").removeClass("disabledDiv");
    });
    $('#close2').click(function()
    {
        $('#container-results').hide();
        $("#analyticalTable").dataTable().fnDestroy();
        $("#syntheticalTable").dataTable().fnDestroy();
        $("#container-rules").removeClass("disabledDiv");
    });   
})();
