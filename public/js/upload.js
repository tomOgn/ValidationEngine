(function() {
    var DocSource, DocType;

  function setButtonStatus(status) {
    switch (status) {
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

    $('#ruleSetsTable').DataTable( {
            "ajax": "/getRules"
        } );

    $('#ruleSetsTable tbody').on( 'click', 'tr', function ()
    {
        $(this).toggleClass('selected');
        var table = $('#ruleSetsTable').DataTable();
        var numRows = table.rows('.selected').data().length;
        if ((numRows > 0))
            $('#button-validate').show();
        else
            $('#button-validate').hide();
    });

    // File input handler.
    var handleFileInput = function(e)
    {
        setButtonStatus('ready');

        // Admit only docx and xml files.
        var file = e.target.files[0];
        if (!file.type.match("application/xml") && 
            !file.type.match("text/xml") &&
            !file.type.match("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
            return;           
        
        // Load the file.  
        var reader = new FileReader();
        reader.onload = (function(f)
        {
            return function(e)
            {
                DocSource = e.target.result;
                DocType = f.type;
                $('#button-upload').show();
            };
        })(file);
        reader.readAsDataURL(file);
    };
    
    // Callback for successful upload.
    var successfulUpload = function(response)
    {
        setButtonStatus('success');
        $('#rulesContainer').show();
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
                DocType: DocType
            },
            success: successfulUpload,
            error: notSuccessfulUpload
        });
    };
    
    // Callback for successful validation.
    function validationSuccess(response)
    {
        $('#containerResults').show();
        var textarea = $("#textareaResults");
        textarea.val("");
        for (var i = 0; i < response.length; i++)
        {
            var ruleSet = "Rule Set = " + response[i]['RuleSet'];
            textarea.val(textarea.val() + ruleSet + "\n");
            var log = response[i]['Log'];
            for (var j = 0; j < log.length; j++)
            {
                var rule = log[j];
                var results = rule["results"];
                textarea.val(textarea.val() + "\tRule = " + rule["rule"] + "\n");
                for (var k = 0; k < results.length; k++)
                {
                    textarea.val(textarea.val() + "\t\tIndex  = " + results[k]['i'] + "\n");
                    textarea.val(textarea.val() + "\t\tValue  = " + results[k]['value'] + "\n");
                    textarea.val(textarea.val() + "\t\tPassed = " + results[k]['valid'] + "\n\n");
                }
            }
            textarea.val(textarea.val() + "\n\n");
        }
    }
    
    // Callback for unsuccessful validation.
    function validationError(xhr, status, err)
    {
        alert(err);
    }
    
    // Validate the document against the selected rules.
    function validateDocument()
    {
        // Get the selected rules.
        var table = $('#ruleSetsTable').DataTable();
        var selectedRows = table.rows('.selected').data();
        var rules = [];
        for (var i = 0; i < selectedRows.length; i++)
            rules.push(selectedRows[i][0]);
        
        // Perform the validation and get the results.
        $.ajax({
            async: false,
            type: 'POST',
            url: '/validation',
            data: { Rules: rules },
            success: validationSuccess,
            error: validationError
        });
    }

    $('#button-upload').click(uploadFile);
    $('#button-validate').click(validateDocument);
    $('#file-input').change(handleFileInput);
})();
