/*
 * @file
 * JavaScript for hr_dashboard.
 CW- contingent worker
 */

var createTHNotificationsService = false;
var globalRole="";
var global_hrm_dashboard;
var THNotificationsService = THNotificationsService || (function () {
    //Private elements
    var _private = {
        notifications: [],
        filteredNotifications: [],
        count: 0,
        unseen: "",
        offset: 0,
        hits: 10,
        currentScrollTop: 0,
        currentDate: '',
        currentCategory: '',
        dataLoaded: false,
        version: 5,
        notificationsDisplayed: 0,
        countDisplayed: 0,
        sortBy: "date",
        filteredType: "actions",
        formInputs:{},
        error: {},
        filteredCategories: {},
        categories:  {
            "sailpoint-idm-notifications" : "IDM",
            "sss-requisitions" : "SSS Requisitions",
            "sss-invoices" : "SSS Invoices",
            "workflow-request" : "Support Central",
            "travel-request" : "Travel",
            "hrapi_servanniversary_v1" : "Service Anniversary",
            "logo-broadcast" : "LoGo",
            "mytech-notifications" : "MyTech",
            "above-beyond-approve_v1.0" : "Impact Award"
        },
        errorHandler: function(container, data){
            var message = "";
            if(data.exceptiondisplaymsg){
                message = data.exceptiondisplaymsg;
            } else if(data.statusmesssage){
                message = data.statusmesssage;
            }
            $(container).html('<div class="well no-content">' + message + '</div>').css('padding', '20px');
        },
        templateSelector: function (category){
            return category + "_template.ejs";
        },
        templateBuilder: function(data, templateName, templateFolder) {
            data.categories = _private.categories;
            return  _private.build(data, templateName, templateFolder);
        },
        build: function(data, templateName, templateFolder){
           var html = "";
           return html = new EJS({url: '/m/eds/hrview/templates/th_notifications/' + templateFolder + templateName + "?v=" + glbFileVerNo }).render(data)  ;
        },
        buildDashboard: function(data){
            var html = "";
            html = new EJS({url: '/m/eds/hrview/templates/th_notifications/dashboard_logo.ejs?v='+ glbFileVerNo }).render(data);
            return html += new EJS({url: '/m/eds/hrview/templates/th_notifications/modal_action.ejs?v='+ glbFileVerNo }).render();
        },
        getNotificationTiming: function(timestamp){
            var today = moment();
            var engagementDate = timestamp;
            var notificationTiming = {};
            if(moment(engagementDate).isSame(today, 'day')){
                notificationTiming.date = 'Today';
                notificationTiming.header = 'Today';
                notificationTiming.value = 1;
            } else {
                notificationTiming.date = moment(engagementDate).format("DD MMM YYYY");
                notificationTiming.header = 'Older';
                notificationTiming.value = 0;
            }
            return notificationTiming;
        },
        getUnseen: function(){
            var countNotificationsUrl = glbDSWSCmpURL + "WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_CallOneService?serviceOp=GE_NOTIFICATION_COUNT_GET&addHeader=GE_AKANA";
            $.ajax({
                      url: countNotificationsUrl,
                      async: false,
                        success: function (unseen) {
                            if(unseen.indexOf("ERROR") < 0){
                                _private.unseen =  unseen != "0" ? unseen : "";
                            }
                        },
                        error: function (textStatus) {
                            console.log("error");
                        }
                    });
        },
        getNotifications: function(){
            var notificationsUrl = glbDSWSCmpURL + "WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_CallOneService?serviceOp=GE_NOTIFICATION_LISTING_GET&addHeader=GE_AKANA";
            $.ajax({
                url: notificationsUrl,
                async: false,
                success: function (notifications) {
                    notifications = _private.cleanResponse(notifications);
                    if (notifications.statuscode != undefined && (notifications.statuscode == "OUTAGE" || notifications.statuscode == "EXCEPTION" )) {
                        _private.error = notifications;
                    } else {
                        _private.initFilteredCategories();
                        var count = 0;
                        var unseen = 0;
                        var todayNotifications = [];
                        var olderNotifications = [];
                        $.each(notifications, function(i, notification){
                            notification.notificationTiming = _private.getNotificationTiming(notification.timestamp);
                            if(notification.turbine_status !== undefined){
                                notification.read = notification.turbine_status.read_status == "read" ? 1 : 0;
                            }
                            notification.actionTaken = false;
                            notification.id = notification.id_str;
                            if(_private.categories[notification.category]){
                                if(notification.turbine_status.read_status === "unread"){
                                    unseen++;
                                }
                                _private.filteredCategories[notification.category].count++;
                                if(notification.notificationTiming.header === "Today"){
                                    todayNotifications.push(notification);
                                } else if(notification.notificationTiming.header === "Older"){
                                    olderNotifications.push(notification);
                                }
                                count++;
                            }
                        });
                        _private.filteredCategories.all.count = count;
                        _private.notifications = todayNotifications.concat(olderNotifications);
                        $.each(_private.notifications, function(i, notification){
                           _private.notifications[i].positionByDate = i;
                        });

                        _private.count = count;
                        _private.unseen = unseen;
                        _private.countDisplayed = count;                    }
                },
                error: function (textStatus) {
                    console.log("error");
                }
            });
        },
        getNotification: function(notification_id){
            var currentNotification = {};
            $.each(_private.notifications, function(index, notification){
                if(notification.id == notification_id){
                    notification.indexInArray = index;
                    currentNotification = notification;
                }
            });
            return currentNotification;
        },
        getAction: function(notification, actionSelected){
            var actionProperties = {};
            $.each(notification.actions, function(index, action){
                if(action.name === actionSelected){
                    actionProperties = action;
                }
            });
            return actionProperties;
        },
        cleanResponse: function(response){
            response = response.replace(/\\n/g, "\\n")
                                    .replace(/\\'/g, "\\'")
                                    .replace(/\\"/g, '\\"')
                                    .replace(/\\&/g, "\\&")
                                    .replace(/\\r/g, "\\r")
                                    .replace(/\\t/g, "\\t")
                                    .replace(/\\b/g, "\\b")
                                    .replace(/\\f/g, "\\f");
            // remove non-printable and other non-valid JSON chars
            response = response.replace(/[\u0000-\u0019]+/g,"");
            response = JSON.parse(response);
            return response;
        },
        doAction: function(notification){
            var actionsUrl =  glbDSWSCmpURL + "WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_CallOneService?serviceOp=GE_NOTIFICATION_ACTION_POST&addHeader=GE_AKANA";
            var actionBody = notification.action.properties.turbine_mobile_body || "{}";
            actionBody = JSON.stringify($.extend($.parseJSON(actionBody), _private.formInputs));
            actionBody = actionBody.replace(/"/g, '\\"');
            var notificationCategory = _private.categories[notification.category];
            if(notification.category === "travel-request"){
                if('pretrip_departure_date' in notification.properties){
                    notificationCategory = "PreTrip-Travel";
                }
            }
            if(notification.category === "mytech-notifications" && notification.action.name === "Review"){
                $.ajax({
                    url: actionsUrl,
                    async: false,
                    method: "POST",
                    data: {
                            notificationId: notification.id,
                            category: _private.categories[notification.category],
                            action: notification.action.name,
                            shownInBrowser: true
                    }
                });
                $('#th-actions-modal').modal('hide');
            } else {
                    var parameters = {
                                method: notification.action.properties.turbine_mobile_http_method || "",
                                body: actionBody || "",
                                notificationId: notification.id,
                                targetUrl: notification.action.properties.turbine_mobile_url || "",
                                category: notificationCategory,
                                action: notification.action.name,
                                comments: notification.comments,
                        };

                    if(notification.category === "above-beyond-approve_v1.0"){
                        actionsUrl = actionsUrl.replace("GE_NOTIFICATION_ACTION_POST","GE_NOTIFICATIONACTION_ANB_POST");
                        var actionAnB = notification.action.properties.turbine_mobile_url.split("/");
                        actionAnB = actionAnB[actionAnB.length-1];

                        var groupsids =  notification.action.properties.turbine_mobile_body || "{}";
                        groupsids = $.parseJSON(groupsids);
                        groupsids = groupsids["groupids"].join(',');
                        groupsids = groupsids.replace(/"/g, '\\"');
                        parameters = {
                            notificationId: notification.id,
                            action: actionAnB,
                            category: notificationCategory,
                            groupids: groupsids,
                            reasonId: notification.actionDetails.reasonId
                        }
                    }

                    $.ajax({
                        url: actionsUrl,
                        async: false,
                        method: "POST",
                        data: parameters,
                        success: function (response) {
                            if(response == "SUCCESS" || response == "200" || response == "208" || response == "204" || response.indexOf('"success":true') >= 0){

                                _private.notifications[notification.indexInArray].actionTaken = true;

                                var confirmationDetails = {};
                                confirmationDetails.text = $(".th-notifications-list").find("[data-notification_id='" + notification.id + "']").find('.th-go-to-detail').text().trim();
                                confirmationDetails.action = notification.action.name;
                                var newContent = new EJS({url: '/m/eds/hrview/templates/th_notifications/confirmation_message.ejs?v=' + glbFileVerNo }).render(confirmationDetails);

                                $(".th-notifications-list").find("[data-notification_id='" + notification.id + "']").addClass("th-notification-message").html(newContent);

                                if(notification.goBack){
                                   $('.th-go-back').trigger('click');
                                }
                                if(notification.turbine_status.read_status === "unread"){
                                    _private.updateUnseen();
                                }

                                $('#th-actions-modal').modal('hide');
                                _private.decreaseCategoryCount(notification);
                                _private.updateDisplayedNotifications();
                            } else {
                                response = _private.cleanResponse(response);
                                if(response.statuscode != undefined){
                                        var message = ""
                                        if(response.exceptiondisplaymsg){
                                            message = response.exceptiondisplaymsg;
                                        } else if(response.statusmesssage){
                                            message = response.statusmesssage;
                                        } else {
                                            message = $(".th-action-error").html();
                                        }
                                        $(".th-action-error").html(message);
                                        $(".th-action-error").removeClass("hide");
                                        $(".th-do-action").button('reset');
                                 }  else {
                                        var message = "This feature is currently unavailable. Please check back later.";
                                        $(".th-action-error").html(message);
                                        $(".th-action-error").removeClass("hide");
                                        $(".th-do-action").button('reset');
                                }
                            }
                        },
                        error: function (textStatus) {
                            console.log("error");
                        }
                    });
            }
        },
        updateStatus: function(notification){
            var updateUrl = glbDSWSCmpURL + "WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_CallOneService?serviceOp=GE_NOTIFICATION_STATUS_PUT&addHeader=GE_AKANA";
            $.ajax({
                url: updateUrl,
                method: "GET",
                data: {
                        notificationId: notification.id,
                        category: _private.categories[notification.category],
                        read_status: "read",
                        action: "Read"
                      },
                success: function (response) {
                    if(response == "204"){
                        $(".th-notifications-list").find("[data-notification_id='" + notification.id + "']").find(".th-go-to-detail").addClass("th-notification-read");
                        $(".th-notifications-list").find("[data-notification_id='" + notification.id + "']").find(".th-msg-text ul li").addClass("th-msg-text-read");
                        _private.notifications[notification.indexInArray].turbine_status.read_status = "read";
                        _private.updateUnseen();
                    }
                },
                error: function (textStatus) {
                    console.log(textStatus);
                }
            });
        },
        dismissNotification: function(notification){
            var updateUrl = glbDSWSCmpURL + "WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_CallOneService?serviceOp=GE_NOTIFICATION_ONE_DELETE&addHeader=GE_AKANA";
            $.ajax({
                url: updateUrl,
                method: "GET",
                data: {
                        notificationId: notification.id,
                        category: _private.categories[notification.category],
                        action: "Dismiss",
                      },
                success: function (response) {
                    if(response == "204"){
                        $('#th-actions-modal').modal('hide');

                        _private.notifications[notification.indexInArray].actionTaken = true;
                        var confirmationDetails = {};
                        confirmationDetails.text = $(".th-notifications-list").find("[data-notification_id='" + notification.id + "']").find('.th-go-to-detail').text().trim();
                        confirmationDetails.action = "Dismiss";
                        var newContent = new EJS({url: '/m/eds/hrview/templates/th_notifications/confirmation_message.ejs?v=' + glbFileVerNo }).render(confirmationDetails);
                        $(".th-notifications-list").find("[data-notification_id='" + notification.id + "']").addClass("th-notification-message").html(newContent);
                        if(notification.goBack){
                           $('.th-go-back').trigger('click');
                        }
                        if(notification.turbine_status.read_status === "unread"){
                            _private.updateUnseen();
                        }
                        _private.decreaseCategoryCount(notification);
                        _private.updateDisplayedNotifications();
                    } else {
                            response = _private.cleanResponse(response);
                            if(response.statuscode != undefined){
                                var message = ""
                                if(response.exceptiondisplaymsg){
                                    message = response.exceptiondisplaymsg;
                                } else if(response.statusmesssage){
                                    message = response.statusmesssage;
                                } else {
                                    message = $(".th-action-error").html();
                                }
                                $(".th-action-error").html(message);
                                $(".th-action-error").removeClass("hide");
                                $(".th-do-action").button('reset');
                            }
                    }
                },
                error: function (textStatus) {
                    console.log("error");
                }
            });
        },
        sortNotifications: function (parameter) {
            _private.sortBy = parameter;
            var newCount = 0;
            if (parameter === "date") {
                var allNotifications = [];
                $.each(_private.notifications, function (i, notification) {
                    if(notification.actionTaken === false){
                        allNotifications.push(notification);
                        newCount++;
                    }
                });
                _private.notifications = allNotifications;
                _private.notifications.sort(function(a, b) { return a.positionByDate - b.positionByDate });

            } else if(parameter === "source") {
                var notificationsBySource = {};
                var notificationsSorted = [];
                $.each(_private.notifications, function (i, notification) {
                    if(notificationsBySource[notification.category] === undefined){
                        notificationsBySource[notification.category] = [];
                    }
                    if(notification.actionTaken === false){
                        notificationsBySource[notification.category].push(notification);
                        newCount++;
                    }
                });

                $.each(notificationsBySource, function (i, source) {
                    notificationsSorted = notificationsSorted.concat(source);
                });

                _private.notifications = notificationsSorted;

            }
            _private.count = newCount;
        },
        initFilteredCategories: function () {
            var showAllSources = {};
            showAllSources.count = 0;
            showAllSources.label = "Show All Sources";
            showAllSources.selected = true;
            _private.filteredCategories['all'] = showAllSources;

            $.each(_private.categories, function (i, category) {
                _private.filteredCategories[i] = {};
                _private.filteredCategories[i].count = 0;
                _private.filteredCategories[i].label = category;
                _private.filteredCategories[i].selected = false;
            });
        },
        setFilteredCategories: function(categories){
            $.each(_private.filteredCategories, function (i, category) {
                _private.filteredCategories[i].selected = false;
            });
            $.each(categories, function (i, category) {
                _private.filteredCategories[category].selected = true;
            });
        },
        decreaseCategoryCount: function(notification){
            _private.filteredCategories[notification.category].count--;
            if(_private.filteredCategories[notification.category].count === 0){
                $('.th-select-categories-filter-row').find("ul li").addClass('disabled');
                $('.th-select-categories-filter-row').find("ul li a label input[value='" + notification.category + "']").prop('disabled', true);
                $('.th-select-categories-filter').multiselect('deselect', notification.category);
            }
        },
        getFilteredCategories: function(){
            var currentFilteredCategories = {}
            if(_private.filteredCategories.all.selected){
                currentFilteredCategories = _private.categories;
            } else {
                $.each(_private.filteredCategories, function (i, category) {
                    if(category.selected){
                        currentFilteredCategories[i] = category.label;
                    }
                });
            }
            return currentFilteredCategories;
        },
        getFilteredType: function(){
            return _private.filteredType;
        },
        filterByCategories: function(categories, notifications){
            return filteredNotifications =  $.grep(notifications, function( notification, index ) {
                        return  categories[notification.category] !== undefined && notification.actionTaken === false  ;
            });
        },
        filterByType: function(type, notifications){
            switch(type){
                case "actions" :
                    return filteredNotifications =  $.grep(notifications, function( notification, index ) {
                            return  notification.actions !== undefined && notification.actionTaken === false  ;
                    });
                    break;
                case "fyi" :
                    return filteredNotifications =  $.grep(notifications, function( notification, index ) {
                            return  notification.actions === undefined && notification.actionTaken === false  ;
                    });
                    break;
                case "all" :
                    return filteredNotifications =  $.grep(notifications, function( notification, index ) {
                            return notification.actionTaken === false ;
                    });
                    break;
            }
        },
        applyFilters: function(type, categories, notifications){
            var filteredNotifications = [];
            filteredNotifications = _private.filterByType(type, notifications);
            filteredNotifications = _private.filterByCategories(categories, filteredNotifications);
            return filteredNotifications;
        },
        hasNotifications: function(){
            var notifications = false;
            $.each(_private.notifications, function(index, notification){
                if(notification.actionTaken === false){
                    notifications = true;
                }
            });
            return notifications;
        },
        updateUnseen: function(){
            if(_private.unseen > 0){
                _private.unseen = _private.unseen - 1;
                var notifications_count = _private.unseen > 0 ? _private.unseen : "";
                $(".badge-th-notifications").html(notifications_count);
            }
        },
        updateDisplayedNotifications: function(){
                _private.countDisplayed = _private.countDisplayed - 1;
                _private.notificationsDisplayed = _private.notificationsDisplayed - 1;
                $(".notifications-displayed").html(_private.notificationsDisplayed + " OF " + _private.countDisplayed );
        },
        getNotificationSpend:function(groupId){
          var updateUrl = glbDSWSCmpURL + "WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_CallOneService?addHeader=GE_AKANA&serviceOp=GE_NOTIFICATION_ANB_SPEND_INFO&groupId="+groupId;
          $.ajax({
              url: updateUrl,
              dataType: "json",
              method: "GET",
              success: function (response) {
                $(".th-notification-detail .spend-overview").show();
                $(".th-notification-detail .remainingMsg").show();
                  $($(".th-notification-detail .spend-overview td")["0"]).html("<b>" + _public.formatNumber(response.spendTarget.amount) + "</b>");
                  $($(".th-notification-detail .spend-overview td")["2"]).html("- <b>" + _public.formatNumber(response.spendTotalBeforeAward.amount) + "</b>");
                  var remaining = response.spendTarget.amount - response.spendTotalBeforeAward.amount;
                  var colorClass = remaining < 0 ? "redNumber" : "greenNumber";
                  $($(".th-notification-detail .spend-overview tr")["2"]).addClass(colorClass);
                  $($(".th-notification-detail .spend-overview td")["4"]).html("<b>" + _public.formatNumber(remaining) + "</b>");
                  var remainingAmount = response.spendTarget.amount - response.nominationTotalAmount.amount - response.spendTotalBeforeAward.amount;
                  var remainingMsg;
                  if(remainingAmount < 0){
                      remainingMsg = "Approving <b>" + $($(".th-notification-detail .list-group-item")["5"]).find("span").html() + "</b> point reward for <b>" + $($(".th-notification-detail .list-group-item")["4"]).find("span").html() + "</b> will put you <span class='redNumber'><b>" + _public.formatNumber(Math.abs(remainingAmount)) + "</b></span> points over spend target.";
                  } else {
                      remainingMsg = "Approving <b>" + $($(".th-notification-detail .list-group-item")["5"]).find("span").html() + "</b> point reward for <b>" + $($(".th-notification-detail .list-group-item")["4"]).find("span").html() + "</b> will leave you with <span class='greenNumber'><b>" + _public.formatNumber(Math.abs(remainingAmount)) + "</b></span> point remaining.";
                  }
                  $(".th-notification-detail .remainingMsg").html(_public.formatNumber(remainingMsg));
              },
              error: function (textStatus) {
                  console.log(textStatus);
              }
          });
        }
    };
    // Public elements
    var _public = {
        init: function () {
            //_private.getNotifications();
            if($.isEmptyObject(_private.error)){
                var data = {};
                data.filteredCategories = _private.filteredCategories;
                data.categories = _private.categories;
                var dashboard = _private.buildDashboard(data);
                $(".th-notifications-dashboard").html(dashboard);
                _public.buildNotificationsList();
                _public.bindEvents();
                $(window).trigger('resize');
            } else {
                $('.th-notifications-dashboard').addClass('block');
                _private.errorHandler('.th-notifications-dashboard', _private.error);
            }
        },
        loadMore: function () {
            _private.offset += _private.hits;
            var notificationsHTML = _public.getNotificationsHtml(_private.offset, _private.hits);
            $(".th-notifications-list").append(notificationsHTML);
            if(_private.offset + _private.hits >= _private.count){
               $('.th-load-more').addClass('hide');
            }
            $(window).trigger('resize');
        },
        bindEvents: function(){
            $('.th-select-categories-filter').multiselect({
                buttonText: function(options, select) {
                        return 'OPTIONS';
                },
                selectedClass: "th-category-selected"
            });
            $('.th-select-categories-filter-row').find('ul').prepend("<li><div class='th-filter-by-reset row-fluid'><div class='span6'><h5>Filter by</h5></div><div class='span5'><a href='#' class='th-reset-link pull-right'>Reset</a></div><div class='span1'></div></div></li>");
            $('body').on('click', '.th-reset-link', function(e){
                e.preventDefault();
                $('.th-select-categories-filter-row').find("ul li a label input[value='all']").trigger('click');
            });
            $('body').on('click', '.th-action, .th-action-button', function(){
                var notification_id = $(this).data("notification_id");
                var notification = _private.getNotification(notification_id);
                notification.categories = _private.categories;
                notification.action = $(this).data("th_action");
                notification.goBack = false;
                if($(this).hasClass('th-action-button')){
                    notification.goBack = true;
                }
                if(notification.action === "Actions" || (notification.action === "Reject" && notification.category === "above-beyond-approve_v1.0")){
                    var modal_content = new EJS({url: '/m/eds/hrview/templates/th_notifications/modal_actions_content.ejs?v='+ glbFileVerNo }).render(notification);
                    $("#th-actions-modal").html(modal_content);
                    $('#th-actions-modal').modal('show');
                    if(notification.action === "Reject"){
                        var updateUrl = glbDSWSCmpURL + "WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_CallOneService?addHeader=GE_AKANA&serviceOp=GE_NOTIFICATION_ANB_DIS_REASON";
                        $.ajax({
                            url: updateUrl,
                            dataType: "json",
                            method: "GET",
                            success: function (response) {
                                $.each(response.reasons,function(index,value){
                                    $(".modal-body #reject-reasons-list").append("<input type='radio' name='gender' value='"+value.id+"'>"+value.title+"<br>");
                                });
                                $($("#reject-reasons-list input")["0"]).prop('checked', true);
                            },
                            error: function (textStatus) {
                                console.log("error");
                            }
                        });
                    }
                }else{
                  notification.actionDetails = {};
                  if((notification.category === "mytech-notifications" && notification.action === "Review") || notification.category === "sss-invoices"){
                      notification.actionDetails = _private.getAction(notification, $(this).data("th_action"));
                  }
                  var openActionContent = true;
                  if(notification.category === "above-beyond-approve_v1.0" && notification.action === "RejectReason"){
                      if($(".modal-body form input:checked").length!==1){
                          openActionContent = false;
                      }else{
                          notification.actionDetails.reasonId = $(".modal-body form input:checked").val();
                      }
                  }
                  if(openActionContent){
                      var modal_content  = new EJS({url: '/m/eds/hrview/templates/th_notifications/modal_action_content.ejs?v='+ glbFileVerNo }).render(notification);
                      $("#th-actions-modal").html(modal_content);
                      $('#th-actions-modal').modal('show');
                  }
                }
            });
            $('body').on('click', '.th-action-link', function(){
                var notification = _private.getNotification($(this).data("notification_id"));
                notification.categories = _private.categories;
                notification.action = {};
                notification.action = _private.getAction(notification, $(this).data("th_action"));
                _private.doAction(notification);
            });
            $('body').on('click', '.inputForm', function(){
                if($(this).hasClass('th-required-field-missed')){
                    $(this).removeClass('th-required-field-missed');
                }
            });
            $('body').on('click', '.th-do-action', function(e){
                e.preventDefault();
                if(!$(".th-action-error").hasClass("hide")){
                    $(".th-action-error").addClass("hide")
                }
                if(!$(".th-action-error-2").hasClass("hide")){
                    $(".th-action-error-2").addClass("hide")
                }
                $(this).button('loading');
                var $btn = $(this);
                var missedValue = false;
                _private.formInputs = {};
                $('.inputForm').each(function(){
                    if($(this).data('ismandatory') && !$(this).val()){
                        missedValue = true;
                        $(this).addClass('th-required-field-missed');
                    }
                    _private.formInputs[$(this).attr('id')] = $(this).val();
                });
                $('.inputFormChBx').each(function(){
                    var chBxId = $(this).data('chbx-id');
                    var chBxVal = $("input[name=" + chBxId + "]:checked").map(function (){return this.value;}).get();
                    console.log(chBxVal);
                    if($(this).data('ismandatory') && chBxVal.length === 0){
                        missedValue = true;
                    }
                    _private.formInputs[chBxId] = chBxVal;
                });
                if(missedValue === false){
                    setTimeout(function () {
                    var notification = _private.getNotification($btn.data("notification_id"));
                    notification.categories = _private.categories;
                    notification.comments = $('.th-idm-comments').val();
                    notification.goBack = $btn.data("go-back");
                    notification.action = {};
                        if($btn.data("th_action") !== "Dismiss"){
                            notification.action = _private.getAction(notification, $btn.data("th_action"));
                            _private.doAction(notification);
                        } else {
                            notification.action.name = "Dismiss";
                            _private.dismissNotification(notification);
                        }
                    }, 100);
                } else {
                    var message = "Missing required field(s).";
                    $(".th-action-error-2").html(message);
                    $(".th-action-error-2").removeClass("hide");
                    $(".th-do-action").button('reset');
                }
            });
            $('body').on('click', '.th-load-more', function(e){
                e.preventDefault();
                $(".th-spinner").removeClass("hide");
                setTimeout(function(){
                _public.loadMore();
                    $(".th-spinner").addClass("hide");
                }, 1500);
            });
            $('body').on('click', '.th-go-to-detail', function(e){
                e.preventDefault();
                $('.th-notification-detail-list .list-group-item').remove();
                _private.currentScrollTop = $(window).scrollTop();
                var notification_id = $(this).data('notification_id');
                var template = 'notification_detail/';
                var notification = _private.getNotification(notification_id);
                if(notification.category === "sss-invoices"){
                    notification.pdfUrl = glbDSWSCmpURL + "WEBLIB_NOTIFY.FUNCLIB.FieldFormula.IScript_GE_SSS_Invoice_PDF?sssInvoiceURL=" + encodeURIComponent(notification.properties.imageurl_link);
                }
                if(notification.category === "above-beyond-approve_v1.0"){
                    notification.nominationDateFormatted = "";
                    var nd =  notification.properties.created;
                    var ndYear = nd.substr(0, 4);
                    var ndMonth = nd.substr(5, 2);
                    var ndDay = nd.substr(8, 2);
                    var ndHr = nd.substr(11, 2);
                    var ndMi = nd.substr(14, 2);
                    var ndSe = nd.substr(16, 2);
                    notification.nominationDateFormatted = moment(ndDay + "-" + ndMonth + "-" + ndYear + " " + ndHr + ":" + ndMi + ":" + ndSe).format('MMMM Do YYYY, h:mm:ss a');
                    if(notification.properties.currencyLabel === "P20"){
                        notification.pointsNominated = parseInt(notification.properties.destAmount.split(" ")[1])
                        _private.getNotificationSpend(notification.properties.groupId);
                        notification.pointsNominatedTitle = "Points nominated for";
                    }else{
                        notification.pointsNominated = notification.properties.destAmount;
                        notification.pointsNominatedTitle = "Award Amount";
                    }
                }
                var templateName = _private.templateSelector(notification.category);
                var notificationDetail = "";
                notification.categories = _private.categories;
                notificationDetail = _private.templateBuilder(notification, templateName, template);
                if(notification.turbine_status.read_status === "unread" && $(this).hasClass('th-prevent-update-status') === false){
                    $(this).addClass("th-prevent-update-status");
                    _private.updateStatus(notification);
                }
                $('.th-notifications-list-opt').animate({'opacity': 0, 'margin-right': $('.th-notifications-list').width()},'slow',
                function(){
                    $('.th-notifications-list-opt').css('display', 'none');
                    $('.th-dashboard').append(notificationDetail);
                });
                $('.th-title').animate({'opacity': 0, 'margin-right': $('.th-notifications-list').width()},'slow',
                function(){
                    $('.th-title').css('display', 'none');
                });
                $("html, body").animate({ scrollTop: 0 }, "slow");
            });
            $('body').on('click', '.th-go-back', function(e){
                var speed = 1000;
                e.preventDefault();
                $('.th-notification-detail').animate({'opacity': 0},'slow',
                function(){
                    $('.th-notification-detail').css('display', 'none');
                    $('.th-dashboard').remove(".th-notification-detail");
                    $('.th-notifications-list-opt, .th-title').css('display', 'block');
                    $('.th-notifications-list-opt, .th-title').animate({'opacity': 1, 'margin-right': "0px"});
                });
                if(_private.currentScrollTop > 1500){
                    speed = 3500;
                }
                $("html, body").animate({ scrollTop: _private.currentScrollTop }, speed);
            });
            $('body').on('click', '.th-btn-sort', function(){
                var sortBy = $(this).data('sort-value');
                _private.sortNotifications(sortBy);
                _public.buildNotificationsList();
                var btnNewValue = $(this).data('sort-value') === 'source' ? 'date' : 'source' ;
                $(this).removeClass("btn-default");
                $(this).addClass("btn-primary");
                $(".th-btn-sort-by-" + btnNewValue).addClass("btn-default");
                $(".th-btn-sort-by-" + btnNewValue).removeClass("btn-primary");

            });
            $('body').on('change', '.th-select-categories-filter', function(){
                if($(this).val() === null){
                        $(this).multiselect('select', 'all');
                        _private.setFilteredCategories(['all']);
                } else if( $(this).val().indexOf("all") >= 0 && _private.filteredCategories.all.selected === false){
                        $(this).multiselect('deselectAll');
                        $(this).multiselect('select', 'all');
                        _private.setFilteredCategories(['all']);
                } else if($(this).val().indexOf("all") >= 0 && _private.filteredCategories.all.selected === true) {
                        var selectedCategories = [];
                        $(this).multiselect('deselect', 'all');
                        $.each($(this).val(), function(i, category){
                            if(category !== "all"){
                                selectedCategories.push(category);
                            }
                        });
                        _private.setFilteredCategories(selectedCategories);
                } else {
                        _private.setFilteredCategories($(this).val());
                }
                _ga('send', 'event', "TH-NOTIFICATIONS", "TH-NOTIFICATIONS.FILTER_NOTIFICATIONS-BY-SOURCE/CLICK", "OPTIONS");
                _public.buildNotificationsList();
            });
            $('body').on('click', '.th-btn-type-filter', function(){
                if($('.th-btn-type-filter').hasClass('btn-primary')){
                    $('.th-btn-type-filter').addClass('btn-default');
                    $('.th-btn-type-filter').removeClass('btn-primary');
                }
                $(this).addClass('btn-primary');
                $(this).removeClass('btn-default');
                _private.filteredType = $(this).data('sort-value');
                _public.buildNotificationsList();
            });
        },
        buildNotificationsList: function(){
                _private.offset = 0;
                _private.hits = 10;
                _private.notificationsDisplayed =  0;
                _private.currentDate = '';
                _private.currentCategory = '';
                var applyFilters = true;
                var notificationsHTML = _public.getNotificationsHtml(_private.offset, _private.hits, applyFilters);
                if(notificationsHTML){
                    $(".th-notifications-list").html(notificationsHTML);
                } else {
                        $(".th-notifications-list").html("<h5>No notifications available.</h5>");
                }
        },
        getNotificationsHtml: function(offset, hits, applyFilters){
            var notificationsList = "";
            var templateName = "";
            var notificationsToDisplay = 0 ;
            var notifications = _private.applyFilters(_private.getFilteredType(), _private.getFilteredCategories(), _private.notifications);
            _private.countDisplayed = notifications.length;
            if(applyFilters){
                _private.filteredNotifications = notifications;
            } else {
                var notifications = _private.filteredNotifications;
            }
            $.each(notifications.slice(offset, offset + hits), function(index, notification){
                var template = "notification/";
                templateName = _private.templateSelector(notification.category);
                if(_private.sortBy === "date"){
                    if(_private.currentDate !== notification.notificationTiming.header){
                        notificationsList += "<h5 class='th-header-text-" + notification.notificationTiming.header.toLowerCase() + "'>" + notification.notificationTiming.header + "</h5>";
                        _private.currentDate = notification.notificationTiming.header;
                    }
                } else if (_private.sortBy === "source"){
                    if(_private.currentCategory !== notification.category){
                        notificationsList += "<h5 class='th-header-text-" + notification.category.toLowerCase() + "'>" + _private.categories[notification.category] + "</h5>";
                        _private.currentCategory = notification.category;
                    }
                }
                notificationsList += _private.templateBuilder(notification, templateName, template);
                notificationsToDisplay++;
            });
            _private.notificationsDisplayed += notificationsToDisplay;
            if(_private.notificationsDisplayed === _private.countDisplayed ){
                $('body').find('.th-load-more').addClass('hide');
            } else {
                $('body').find('.th-load-more').removeClass('hide');
            }

            _public.updateNotificationsDisplayed();
            return notificationsList;
        },
        updateNotificationsDisplayed: function(){
            $(".notifications-displayed").html( _private.notificationsDisplayed + " OF " + _private.countDisplayed );
        },
        goToDashboard: function(){
            window.location.href = "../s/WEBLIB_NOTIFY.FUNCLIB.FieldFormula.IScript_GE_Notification_List?isAjax=true";
        },
        getTHData: function(){
            $(".badge-th-notifications").empty();
            //_private.getUnseen();
            _private.getNotifications();
            _private.dataLoaded = true;
            var unseen = _private.unseen > 0 ? _private.unseen : "";
            $(".badge-th-notifications").html(unseen);

        },
        isManagerView: function(viewName){
             return _public.compareViews("GE_MNGRVIEW", viewName);
        },
        compareViews: function(baseView, comparedView) {
            return baseView.indexOf(comparedView) > -1 ? true : false;
        },
        dataIsLoaded: function(){
            return _private.dataLoaded;
        },
        formatNumber: function(num) {
            return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
        }
    };
    return _public;
})();

if(THNotificationsService.isManagerView(glbSiteName)){
    (function createTHNotifications(){
        setTimeout(function () {
            if(federation3lHandler.Utils.getTokenStatus()){
                        THNotificationsService.getTHData();
            } else {
                    createTHNotifications();
            }
        }, 1500);
    })();
}

errorHandler = function (container, data) {
    $(container).closest('.span8').show();
    $(container).closest(".block").html('<div class="well no-content">' + data.statusmesssage + '</div>').css('padding', '20px');
}

hrm_dashboard = function () {

    var link, hide_dashboard, metricHrReportChartURL, cw_metricHrReportChartURL, user_metric, band_angular, country_angular, function_angular, def_link, url, summary, stats_url, selector_url, Set1, Set2, Set3, Set4, Set5, err_msg, insertDataHeadCount, insertDataExit, insertDataVacancy, role_mapping_string, roleObj, roleSelected, role, def_link_cw, cw_selector_url, cw_metric, cw_user_metric, cw_summary, cw_stats_url, cw_dashboard_string_yp, cw_dashboard_string_cw, dashboard_count_role, cw_browser_back, cw_browser_back_get;
    link = settings.hr_dashboard.hrvar;
    hide_dashboard = link.hide_hr_dashboard_region;


    metricHrReportChartURL = glbDSWSCmpURL + "WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_GetJsonData?serviceOp=GE_HR_REPORTMETRIC_GET&addHeader=GE_SENTRY";
    cw_metricHrReportChartURL = glbDSWSCmpURL + "WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_GetJsonData?serviceOp=GE_HR_REPORTMETRIC_GET&addHeader=GE_SENTRY";

    /** var for rotate angular**/
    band_angular = settings.hr_dashboard.hrvar.band_angular_axis;
    country_angular = settings.hr_dashboard.hrvar.country_angular_axis;
    function_angular = settings.hr_dashboard.hrvar.function_angular_axis;

    url = settings.hr_dashboard.base_url;
    summary = settings.hr_dashboard.hrvar.summary_statistics_url;
    cw_summary = settings.hr_dashboard.hrvar.cw_summary_statistics_url;
    user_metric = metricHrReportChartURL.replace('{sso}', link.username);
    cw_user_metric = cw_metricHrReportChartURL.replace('{sso}', link.username);
    stats_url = summary.replace('{sso}', link.username);
    cw_stats_url = cw_summary.replace('{sso}', link.username);
    selector_url = link.dashboard_role_selector_api.replace('{sso}', link.username);

    cw_selector_url = link.dashboard_role_selector_api.replace('{sso}', link.username);
    err_msg = settings.hr_dashboard.hrvar.err_msg;
    role_mapping_string = link.dashboard_session_role_mapping;
    roleObj = role_mapping_string.Data[0];
    roleSelected = link.selected_role;
    localStorage.setItem("hr_client_list_manager_role", link.hr_client_list_manager_role);
    // CW dashboard changes
    cw_dashboard_string_yp = settings.hr_dashboard.hrvar.your_people;
    cw_dashboard_string_cw = settings.hr_dashboard.hrvar.contingent_worker;

    role = '';
    Set1 = [];
    Set2 = [];
    Set3 = [];
    Set4 = [];
    Set5 = [];

    // Hide Block on page load
    if (hide_dashboard === "yes") {
        $(".pane-hr-dashboard-hr-dashboard-block").closest('.span8').hide();
        $(".pane-hr-dashboard-hr-dashboard-block").parent().parent().css("margin-bottom", "0px");
    } else {
        $(".pane-hr-dashboard-hr-dashboard-block").hide();
    }

    //Identifying which role user has requested from mapping setting values
    $.each(roleObj, function (key, value) {
        if (key === roleSelected) {
            role = value;
        }
    });
    dashboard_count_role = role;

    /* For HRM role*/

    if (role.indexOf("HRM") > -1) {
        //console.log('rolename--->' + role);
        // CW browser back retain dashboard view.
        cw_browser_back_get = localStorage.getItem("cw_browser_back_var");
        cw_browser_back_get=""; /* cleanup ls */
        if (cw_browser_back_get == null || cw_browser_back_get == '') {
            cw_browser_back_get = "IsFalse";
        }
        var domain = glbDSWSCmpURL.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i);
        $.ajax({
            dataType: "json",
            //  For HR Role Calling
            url: glbDSWSCmpURL + "WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_GetJsonData?serviceOp=GE_HRROLE_SERVICEOPR_GET&addHeader=GE_SENTRY",
            //url: domain[0] + "m/eds/hrview/json_example/hr_role.json",
            success: function (responseData) {
                globalRole=responseData;
                if (responseData.statuscode != undefined && responseData.statuscode == "OUTAGE") {
                    errorHandler('#hrdashboad_pad', responseData);
                } else if (responseData !== null) {
                    $('.communication-loading-widget').remove();
                    $("#response").addClass("hide");
                    $('.dashboard-container').removeClass("hide");
                    var hrm_dashboard, selected_role, hrm_role, user_metric_role, cw_user_metric_role;
                    hrm_dashboard = JSON.parse(link.dashboard_role_mapping);
					global_hrm_dashboard= JSON.parse(link.dashboard_role_mapping);
                    localStorage.setItem("dashboard_role_mapping", link.dashboard_role_mapping);
                    selected_role = responseData[0].role;
                    hrm_role = stats_url.replace('{role}', responseData[0].role);
                    user_metric_role = user_metric.replace('{role}', responseData[0].role);
                    //console.log('user_metric_role--->'+user_metric_role);

                    for (i = 0; i < responseData.length; i = i + 1) {
                        if (responseData[i].role !== '') {
                            if (i === 0) {
                                $('.hr_roles_dropdown .dropdown-menu').append('<li id="hr_role" selected="selected"><a value="' + responseData[i].role + '">' + hrm_dashboard[responseData[i].role] + '</a></li>');
                            } else {
                                $('.hr_roles_dropdown .dropdown-menu').append('<li id="hr_role"><a value="' + responseData[i].role + '">' + hrm_dashboard[responseData[i].role] + '</a></li>');
                            }
                        }
                    }
                    $("body").on('click', ".hr_roles_dropdown .dropdown-menu li a", function (event) {
                        $('.head-count-charts').attr('data-load', "false").addClass('hide-charts');;
                        $('.dashboard-charts-view').children('.icon-ico_chevron_down_lg').removeClass('icon-rotate-180');
                        $('.dashboard-container').addClass("hide");
                        $("#response").addClass("hide");
                        $("#dashboard-loading-img").removeClass("hide");
                        $(".hr_roles_dropdown .dropdown-menu li").each(function () {
                            $(this).removeAttr("selected");
                        });
                        $(this).parent().attr("selected", "selected");
                        selected_role = $(this).attr('value');
                        user_metric_role = user_metric.replace('{role}', selected_role);
                        var firstrole = $(this).parent().text();
                        $('.hr_roles_dropdown .first_role').attr("alt", firstrole).html(firstrole);
                        hrm_role = stats_url.replace('{role}', selected_role);
                        var firstrole_yp = $('.cw_roles_dropdown .first_role').text();
                        if (firstrole_yp == cw_dashboard_string_yp) {
                            dashboard_graph(selected_role);
                            summary_statistics(selected_role, true);
                        } else {
                            dashboard_graph(selected_role);
                        }
                    });
                    $('.hr_roles_dropdown .first_role').attr("alt", hrm_dashboard[responseData[0].role]).html(hrm_dashboard[responseData[0].role]);
                    $(".hr_roles_dropdown").removeClass("hide");
                    $(".pane-hr-dashboard-hr-dashboard-block").closest('.span8').show();
                    $(".pane-hr-dashboard-hr-dashboard-block").show();
                    $(".pane-hr-dashboard-hr-dashboard-block").parent().parent().css("margin-bottom", "1em");
                    var firstrole_yp = $('.cw_roles_dropdown .first_role').text();
                    if (firstrole_yp == cw_dashboard_string_yp && cw_browser_back_get == "IsFalse") {
                        // CW browser back retain dashboard view.
                        $('.cwrk').removeAttr("selected");
                        $('.yppl').attr("selected", "selected");
                        var firstrole_n = $('.yppl a').text();
                        $('.cw_roles_dropdown .first_role').attr("alt", firstrole_n).html(firstrole_n);
                        // Hide CW dashboard.
                        $(".cw-inverted").addClass("hide");
                        $('.cw-head-count-charts').addClass("hide");
                        $('.cw-def-link').addClass("hide");

                        dashboard_graph(selected_role);
                        summary_statistics(selected_role, false);
                    } else {
                        // CW browser back retain dashboard view.
                        $('.yppl').removeAttr("selected");
                        $('.cwrk').attr("selected", "selected");
                        var firstrole_n = $('.cwrk a').text();
                        $('.cw_roles_dropdown .first_role').attr("alt", firstrole_n).html(firstrole_n);
                        // Hide your people dashboard.
                        $('.hr-inverted').addClass("hide");
                        $('.dashboard-charts-view .dashboard-contingent').removeClass('hide');
                        $('.dashboard-charts-view .dashboard-people').addClass('hide');
                        $('.hr-head-count-charts').addClass("hide");
                        $('.hr-def-link').addClass("hide");

                        dashboard_graph(selected_role);
                    }
                } else {
                    dashboardError();
                }
            },
            error: function (textStatus) {
                dashboardError();
            }
        });

        // cw dashboard changes
        $('body').on('click', ".cw_roles_dropdown .dropdown-menu li a", function (event) {
            $(".cw_roles_dropdown .dropdown-menu li").each(function () {
                $(this).removeAttr("selected");
            });
            $(this).parent().attr("selected", "selected");
            var firstrole = $(this).parent().text();
            $('.cw_roles_dropdown .first_role').attr("alt", firstrole).html(firstrole);
            $.ajax({
                dataType: "json",
                url: glbDSWSCmpURL + "WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_GetJsonData?serviceOp=GE_HRROLE_SERVICEOPR_GET&addHeader=GE_SENTRY",
                success: function (responseData) {
                    if (responseData.statuscode != undefined && responseData.statuscode == "OUTAGE") {
                        errorHandler('#hrdashboad_pad', responseData);
                    } else if (responseData !== null) {
                        $("#response").addClass("hide");
                        $("#dashboard-loading-img").removeClass("hide");
                        $('.hr-head-count-charts , .cw-head-count-charts').addClass('hide-charts');
                        $('.dashboard-charts-view').children('.icon-ico_chevron_down_lg').removeClass('icon-rotate-180');
                        selected_role = $(".hr_roles_dropdown .dropdown-menu li[selected] a").attr('value');
                        cw_user_metric_role = cw_user_metric.replace('{role}', selected_role);
                        hrm_role = cw_stats_url.replace('{role}', selected_role);
                        if (firstrole == cw_dashboard_string_yp) {
                            // CW browser back retain dashboard view.
                            $('.cwrk').removeAttr("selected");
                            $('.yppl').attr("selected", "selected");
                            var firstrole_n = $('.yppl a').text();
                            $('.cw_roles_dropdown .first_role').attr("alt", firstrole_n).html(firstrole_n);
                            // Hide CW dashboard.
                            $(".cw-inverted").addClass("hide");
                            $('.cw-head-count-charts').addClass("hide");
                            $('.cw-def-link').addClass("hide");

                            // Localstorage for CW browser back retain dashboard view.
                            cw_browser_back = "IsFalse";
                            localStorage.setItem("cw_browser_back_var", cw_browser_back);
                             $('.dashboard-charts-view .dashboard-contingent').addClass('hide');
                            $('.dashboard-charts-view .dashboard-people').removeClass('hide');
                            dashboard_graph(selected_role);
                            summary_statistics(selected_role, false);
                        } else {
                            // CW browser back retain dashboard view.
                            $('.yppl').removeAttr("selected");
                            $('.cwrk').attr("selected", "selected");
                            var firstrole_n = $('.cwrk a').text();
                            $('.cw_roles_dropdown .first_role').attr("alt", firstrole_n).html(firstrole_n);
                            // Hide your people dashboard.
                            $('.hr-inverted').addClass("hide");
                            $('.dashboard-charts-view .dashboard-contingent').removeClass('hide');
                            $('.dashboard-charts-view .dashboard-people').addClass('hide');
                            $('.hr-head-count-charts').addClass("hide");
                            $('.hr-def-link').addClass("hide");
                            // Localstorage for CW browser back retain dashboard view.
                            cw_browser_back = "IsTrue";
                            localStorage.setItem("cw_browser_back_var", cw_browser_back);
                            $('.dashboard-charts-view .dashboard-contingent').removeClass('hide');
                            $('.dashboard-charts-view .dashboard-people').addClass('hide');
                            dashboard_graph(selected_role);
                        }
                    } else {
                        dashboardError();
                    }
                },
                error: function (textStatus) {
                    dashboardError();
                }
            });
        });
    }
    /* For ORG_MGR role*/
    else if (role.indexOf("MGR") > -1) {
        //console.log('rolename--->'+role);
        // CW browser back retain dashboard view
        var selected_role = "";
        if (role.indexOf(',') > -1) {
            selected_role = role.slice(0, role.indexOf(","));
        } else {
            selected_role = role;
        }

        cw_browser_back_get = localStorage.getItem("cw_browser_back_var_org");
				cw_browser_back_get=""; /* cleanup ls */
        if (cw_browser_back_get === null || cw_browser_back_get === '') {
            cw_browser_back_get = "IsFalse";
        }
        var firstrole_yp = $('.cw_roles_dropdown .first_role').text();
        if (firstrole_yp == cw_dashboard_string_yp && cw_browser_back_get == "IsFalse") {
            // CW browser back retain dashboard view.
            $('.cwrk').removeAttr("selected");
            $('.yppl').attr("selected", "selected");
            var firstrole_n = $('.yppl a').text();
            $('.cw_roles_dropdown .first_role').attr("alt", firstrole_n).html(firstrole_n);
            // Hide CW dashboard.
            $(".cw-inverted").addClass("hide");
            $('.cw-head-count-charts').addClass("hide");
            $('.dashboard-charts-view .dashboard-contingent').addClass('hide');
            $('.dashboard-charts-view .dashboard-people').removeClass('hide');
            $('.cw-def-link').addClass("hide");

            dashboard_graph(selected_role);
            summary_statistics(selected_role, false);
        } else {
            // CW browser back retain dashboard view.
            $('.yppl').removeAttr("selected");
            $('.cwrk').attr("selected", "selected");
            var firstrole_n = $('.cwrk a').text();
            $('.cw_roles_dropdown .first_role').attr("alt", firstrole_n).html(firstrole_n);
            // Hide your people dashboard.
            $('.hr-inverted').addClass("hide");
            $('.dashboard-charts-view .dashboard-contingent').removeClass('hide');
            $('.dashboard-charts-view .dashboard-people').addClass('hide');
            $('.hr-head-count-charts').addClass("hide");
            $('.hr-def-link').addClass("hide");

            dashboard_graph(selected_role);
        }
        // CW dashboard changes.
        $('body').on('click', ".cw_roles_dropdown .dropdown-menu li a", function (event) {
             $('.head-count-charts').attr('data-load', "false").addClass('hide-charts');;
            $('.dashboard-charts-view').children('.icon-ico_chevron_down_lg').removeClass('icon-rotate-180');

            $(".cw_roles_dropdown .dropdown-menu li").each(function () {
                $(this).removeAttr("selected");
            });
            $(this).parent().attr("selected", "selected");
            var firstrole = $(this).parent().text();
            $('.cw_roles_dropdown .first_role').attr("alt", firstrole).html(firstrole);
            if (($(this).attr("value")) == "CW") {
                $(".your_people").hide();
            }
            if (firstrole == cw_dashboard_string_yp) {
                // CW browser back retain dashboard view.
                $('.cwrk').removeAttr("selected");
                $('.yppl').attr("selected", "selected");
                var firstrole_n = $('.yppl a').text();
                $('.cw_roles_dropdown .first_role').attr("alt", firstrole_n).html(firstrole_n);
                // Hide CW dashboard.
                $(".cw-inverted").addClass("hide");
                $('.dashboard-charts-view .dashboard-contingent').addClass('hide');
                $('.dashboard-charts-view .dashboard-people').removeClass('hide');
                $('.cw-head-count-charts').addClass("hide");
                $('.cw-def-link').addClass("hide");

                // Localstorage for CW browser back retain dashboard view.
                cw_browser_back = "IsFalse";
                localStorage.setItem("cw_browser_back_var_org", cw_browser_back);

                dashboard_graph(selected_role);
                summary_statistics(selected_role, false);
            } else {
                // CW browser back retain dashboard view.
                $('.yppl').removeAttr("selected");
                $('.cwrk').attr("selected", "selected");
                var firstrole_n = $('.cwrk a').text();
                $('.cw_roles_dropdown .first_role').attr("alt", firstrole_n).html(firstrole_n);
                // Hide your people dashboard.
                $('.hr-inverted').addClass("hide");
                $('.dashboard-charts-view .dashboard-contingent').removeClass('hide');
                $('.dashboard-charts-view .dashboard-people').addClass('hide');
                $('.hr-head-count-charts').addClass("hide");
                $('.hr-def-link').addClass("hide");

                // Localstorage for CW browser back retain dashboard view.
                cw_browser_back = "IsTrue";
                localStorage.setItem("cw_browser_back_var_org", cw_browser_back);

                dashboard_graph(selected_role);
            }
        });
    }

    function dashboardError() {
        if (hide_dashboard === "yes") {
            $('.pane-hr-dashboard-hr-dashboard-block').closest('.span8').remove();
            $(".pane-hr-dashboard-hr-dashboard-block").parent().parent().css("margin-bottom", "0px");
        } else {
            $(".pane-hr-dashboard-hr-dashboard-block").addClass("hide");
        }
    }

    function dashboard_graph(user_metric_role) {
        var i, metric_type, view_by;
        var hrReportChartURL = glbDSWSCmpURL + "WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_GetJsonData?serviceOp=GE_HR_REPORTMETRIC_GET&addHeader=GE_SENTRY";
        for (i = 0; i < 3; i = i + 1) {
            metric_type = link.metric_type[0];
            view_by = link.view_by[i];
            view_by = hrReportChartURL + "&role=" + user_metric_role + "&metric=" + metric_type + "&viewby=" + view_by
            //console.log('Set1--->'+view_by);
            Set1[i] = view_by;
        }

        for (i = 0; i < 3; i = i + 1) {
            metric_type = link.metric_type[1];
            view_by = link.view_by[i];
            view_by = hrReportChartURL + "&role=" + user_metric_role + "&metric=" + metric_type + "&viewby=" + view_by
            //console.log('Set2--->'+view_by);
            Set2[i] = view_by;
        }

        for (i = 0; i < 3; i = i + 1) {
            metric_type = link.metric_type[2];
            view_by = link.view_by[i];
            view_by = hrReportChartURL + "&role=" + user_metric_role + "&metric=" + metric_type + "&viewby=" + view_by
            //console.log('Set3--->'+view_by);
            Set3[i] = view_by;
        }

        // CW dashboard changes.
        for (i = 0; i < 2; i = i + 1) {
            metric_type = link.cw_metric_type[0];
            view_by = link.cw_view_by[0];
            view_by = hrReportChartURL + "&role=" + user_metric_role + "&metric=" + metric_type + "&viewby=" + view_by
            //console.log('Set4--->'+view_by);
            Set4[i] = view_by;
        }
        for (i = 0; i < 2; i = i + 1) {
            metric_type = link.cw_metric_type[0];
            view_by = link.cw_view_by[1];
            view_by = hrReportChartURL + "&role=" + user_metric_role + "&metric=" + metric_type + "&viewby=" + view_by
            //  console.log('Set5--->'+view_by);
            Set5[i] = view_by;
        }
    }

    function getChart(id1, id2) {
        var aryName, dd_role, role_url, chart_url;
        aryName = eval("Set" + id1);
        dd_role = $(".hr_roles_dropdown .dropdown-menu li[selected='selected'] a").attr('value');
        role_url = aryName[id2];

        if (role.indexOf("HRM") > -1) {
            chart_url = role_url.replace(/(role=).*?(&)/, '$1' + dd_role + '$2');
        }
        else if (role.indexOf("MGR") > -1) {
            chart_url = role_url;
        }

        switch (id1) {
            case '1':
                $('#hr_analytics_link_1 a').attr('href', settings.hr_dashboard.hrvar.hc_analytics[id2]);
                $('#hc-chart-loading-img').css("display", "block");
                $('#chart-column-headcount').addClass("hide");
                drawChart(chart_url, insertDataHeadCount, parseInt(id2, 10));
                break;
            case '2':
                $('#hr_analytics_link_2 a').attr('href', settings.hr_dashboard.hrvar.exit_analytics[id2]);
                $('#ex-chart-loading-img').css("display", "block");
                $('#chart-column-exits').addClass("hide");
                drawChart(chart_url, insertDataExit, parseInt(id2, 10));
                break;
            case '3':
                $('#hr_analytics_link_3 a').attr('href', settings.hr_dashboard.hrvar.vac_analytics[id2]);
                $('#vac-chart-loading-img').css("display", "block");
                $('#chart-column-vacancies').addClass("hide");
                drawChart(chart_url, insertDataVacancy, parseInt(id2, 10));
                break;
                // CW dashboard changes.
            case '4':
                $('#cw-chart-loading-img').css("display", "block");
                $('#chart-column-cw').addClass("hide");
                drawChart(chart_url, insertDataContigentWorker, parseInt(id2, 10));
                break;
            case '5':
                $('#tos-chart-loading-img').css("display", "block");
                $('#chart-col-cw-tos').addClass("hide");
                drawChart(chart_url, insertDataContigentWorkerTOS, parseInt(id2, 10));
                break;
        }
    }

    /* Function defined for HeadCount starts here*/
    insertDataHeadCount = function (data, successFlag, id) {
        //console.log("successFlag-->"+successFlag+"id="+id);
        if ($.trim(data).length > 0 && successFlag) {
            var t, options;
            switch (id) {
                case 0:
                    t = parseInt(band_angular, 10);
                    break;
                case 1:
                    t = parseInt(country_angular, 10);
                    break;
                case 2:
                    t = parseInt(function_angular, 10);
                    break;
            }
            if ($('html').hasClass('lt-ie9')) {
                options = {
                    series: [{
                            color: '#0B2161',
                            data: []
                        }],
                    chart: {
                        height: 250,
                        width: 180,
                        marginBottom: 50
                    },
                    xAxis: {
                        categories: [],
                        labels: {
                            rotation: t,
                            style: {
                                color: '#262626',
                                fontWeight: 'normal',
                                fontSize: '10px',
                                fontFamily: 'courier',
                            }
                        }
                    },
                    tooltip: {
                        style: {
                            color: '#262626',
                            fontWeight: 'normal',
                            fontSize: '9px',
                            fontFamily: 'courier',
                            padding: '2px',
                            align: 'center',
                        },
                        hideDelay: 100,
                        formatter: function () {
                            var self, dataValues;
                            self = this;
                            dataValues = getShortValue(data, this.x);
                            if (dataValues !== undefined) {
                                return '<div style="width: 135px;">' + dataValues.viewBy + '<br/>' + this.y + '</div>';
                            }
                        }
                    },
                    yAxis: {
                        title: {
                            text: null
                        },
                        labels: {
                            style: {
                                color: '#262626',
                                fontWeight: 'normal',
                                fontSize: '10px',
                                fontFamily: 'courier',
                            }
                        }
                    },
                    legend: {
                        enabled: false
                    }
                };
            }
            else {
                options = {
                    series: [{
                            color: '#0B2161',
                            data: []
                        }],
                    chart: {
                        height: 250,
                        width: 224,
                        marginBottom: 50,
                        events: {
                            load: function () {
                                if ($('.hr_roles_dropdown').hasClass('hide')) {
                                    $('.hr_roles_dropdown').parent().addClass("mgr-def-btn");
                                }
                            }
                        }
                    },
                    xAxis: {
                        categories: [],
                        labels: {
                            rotation: t,
                            style: {
                                color: '#262626',
                                fontWeight: 'normal',
                                fontSize: '12px',
                                fontFamily: 'courier',
                            }
                        }
                    },
                    tooltip: {
                        style: {
                            color: '#262626',
                            fontWeight: 'normal',
                            fontSize: '12px',
                            fontFamily: 'courier',
                        },
                        hideDelay: 100,
                        formatter: function () {
                            var self, dataValues;
                            self = this;
                            dataValues = getShortValue(data, this.x);
                            if (dataValues !== undefined) {
                                return dataValues.viewBy + '<br/>' + this.y;
                            }
                        }
                    },
                    yAxis: {
                        title: {
                            text: null
                        },
                        labels: {
                            style: {
                                color: '#262626',
                                fontWeight: 'normal',
                                fontSize: '12px',
                                fontFamily: 'courier',
                            }
                        }
                    },
                    legend: {
                        enabled: false
                    }
                };
            }

            $.each(data, function (i, item) {
                options.xAxis.categories.push(data[i].viewByShortName);
            });
            $.each(data, function (i, item) {
                options.series[0].data.push(data[i].empCount);
            });

        } else {
            $('#chart-column-headcount').html("<div><span class='no_graph'>" + err_msg + "</span></div>");
        }
    };

    /**
     *  This function is used for returning the part of array which matches the key
     *
     *  @param arr Array
     *  @param val String
     *  @return self.itemArray Array
     *
     **/
    function getShortValue(arr, val) {
        var self = this;
        $.each(arr, function (i, item) {
            if (item.viewByShortName === val) {
                self.itemArray = item;
            }
        });
        return self.itemArray;
    }

    /* Function defined for HeadCount ends here*/

    /* Function defined for Exit starts here*/

    insertDataExit = function (data, successFlag, id) {
        if ($.trim(data).length > 0 && successFlag) {
            var t, options;
            switch (id) {
                case 0:
                    t = parseInt(band_angular, 10);
                    break;
                case 1:
                    t = parseInt(country_angular, 10);
                    break;
                case 2:
                    t = parseInt(function_angular, 10);
                    break;
            }
            if ($('html').hasClass('lt-ie9')) {
                options = {
                    series: [{
                            color: 'purple',
                            data: []
                        }],
                    chart: {
                        height: 250,
                        width: 180,
                        marginBottom: 50
                    },
                    xAxis: {
                        categories: [],
                        labels: {
                            rotation: t,
                            style: {
                                color: '#262626',
                                fontWeight: 'normal',
                                fontSize: '10px',
                                fontFamily: 'courier',
                            }
                        }
                    },
                    tooltip: {
                        style: {
                            color: '#262626',
                            fontWeight: 'normal',
                            fontSize: '9px',
                            fontFamily: 'courier',
                            padding: '2px',
                        },
                        hideDelay: 100,
                        formatter: function () {
                            var self, dataValues;
                            self = this;
                            dataValues = getShortValue(data, this.x);
                            if (dataValues !== undefined) {
                                return '<div style="width: 135px;">' + dataValues.viewBy + '<br/>' + this.y + '</div>';
                            }
                        }
                    },
                    yAxis: {
                        title: {
                            text: null
                        },
                        labels: {
                            style: {
                                color: '#262626',
                                fontWeight: 'normal',
                                fontSize: '10px',
                                fontFamily: 'courier',
                            }
                        }
                    },
                    legend: {
                        enabled: false
                    }
                };
            }
            else {
                options = {
                    series: [{
                            color: 'purple',
                            data: []
                        }],
                    chart: {
                        height: 250,
                        width: 224,
                        marginBottom: 50
                    },
                    xAxis: {
                        categories: [],
                        labels: {
                            rotation: t,
                            style: {
                                color: '#262626',
                                fontWeight: 'normal',
                                fontSize: '12px',
                                fontFamily: 'courier',
                            }
                        }
                    },
                    tooltip: {
                        style: {
                            color: '#262626',
                            fontWeight: 'normal',
                            fontSize: '12px',
                            fontFamily: 'courier',
                        },
                        hideDelay: 100,
                        formatter: function () {
                            var self, dataValues;
                            self = this;
                            dataValues = getShortValue(data, this.x);
                            if (dataValues !== undefined) {
                                return dataValues.viewBy + '<br/>' + this.y;
                            }
                        }
                    },
                    yAxis: {
                        title: {
                            text: null
                        },
                        labels: {
                            style: {
                                color: '#262626',
                                fontWeight: 'normal',
                                fontSize: '12px',
                                fontFamily: 'courier',
                            }
                        }
                    },
                    legend: {
                        enabled: false
                    }
                };
            }
            $.each(data, function (i, item) {
                options.xAxis.categories.push(data[i].viewByShortName);
            });
            $.each(data, function (i, item) {
                options.series[0].data.push(data[i].exitCount);
            });
        } else {
            $('#chart-column-exits').html("<div><span class='no_graph'>" + err_msg + "</span></div>");
        }
    };

    /* Function defined for Exit ends here*/

    /* Function defined for Vacancy starts here*/

    insertDataVacancy = function (data, successFlag, id) {
        if ($.trim(data).length > 0 && successFlag) {
            var t, options;
            switch (id) {
                case 0:
                    t = parseInt(band_angular, 10);
                    break;
                case 1:
                    t = parseInt(country_angular, 10);
                    break;
                case 2:
                    t = parseInt(function_angular, 10);
                    break;
            }
            if ($('html').hasClass('lt-ie9')) {
                options = {
                    series: [{
                            color: '#BE3800',
                            data: []
                        }],
                    chart: {
                        height: 250,
                        width: 180,
                        marginBottom: 50
                    },
                    xAxis: {
                        categories: [],
                        labels: {
                            rotation: t,
                            style: {
                                color: '#262626',
                                fontWeight: 'normal',
                                fontSize: '10px',
                                fontFamily: 'courier',
                            }
                        }
                    },
                    tooltip: {
                        style: {
                            color: '#262626',
                            fontWeight: 'normal',
                            fontSize: '9px',
                            fontFamily: 'courier',
                            padding: '2px',
                        },
                        hideDelay: 100,
                        formatter: function () {
                            var self, dataValues;
                            self = this;
                            dataValues = getShortValue(data, this.x);
                            if (dataValues !== undefined) {
                                return '<div style="width: 135px;">' + dataValues.viewBy + '<br/>' + this.y + '</div>';
                            }
                        }
                    },
                    yAxis: {
                        title: {
                            text: null
                        },
                        labels: {
                            style: {
                                color: '#262626',
                                fontWeight: 'normal',
                                fontSize: '10px',
                                fontFamily: 'courier',
                            }
                        }
                    },
                    legend: {
                        enabled: false
                    }
                };
            }
            else {
                options = {
                    series: [{
                            color: '#BE3800',
                            data: []
                        }],
                    chart: {
                        height: 250,
                        width: 224,
                        marginBottom: 50
                    },
                    xAxis: {
                        categories: [],
                        labels: {
                            rotation: t,
                            style: {
                                color: '#262626',
                                fontWeight: 'normal',
                                fontSize: '12px',
                                fontFamily: 'courier',
                            }
                        }
                    },
                    tooltip: {
                        style: {
                            color: '#262626',
                            fontWeight: 'normal',
                            fontSize: '12px',
                            fontFamily: 'courier'
                        },
                        hideDelay: 100,
                        formatter: function () {
                            var self, dataValues;
                            self = this;
                            dataValues = getShortValue(data, this.x);
                            if (dataValues !== undefined) {
                                return dataValues.viewBy + '<br/>' + this.y;
                            }
                        }
                    },
                    yAxis: {
                        title: {
                            text: null
                        },
                        labels: {
                            style: {
                                color: '#262626',
                                fontWeight: 'normal',
                                fontSize: '12px',
                                fontFamily: 'courier',
                            }
                        }
                    },
                    legend: {
                        enabled: false
                    }
                };
            }
            $.each(data, function (i, item) {
                options.xAxis.categories.push(data[i].viewByShortName);
            });
            $.each(data, function (i, item) {
                options.series[0].data.push(data[i].vacancyCount);
            });

        } else {
            $('#chart-column-vacancies').html("<div><span class='no_graph'>" + err_msg + "</span></div>");
        }
    };

    /* Function defined for Vacancy ends here*/

    /* Function defined for CW starts here*/
    insertDataContigentWorker = function (data, successFlag, id) {
        if ($.trim(data).length > 0 && successFlag) {
            var t, options;
            switch (id) {
                case 0:
                    t = parseInt(band_angular, 10);
                    break;
                case 1:
                    t = parseInt(country_angular, 10);
                    break;
                case 2:
                    t = parseInt(function_angular, 10);
                    break;
            }
            if ($('html').hasClass('lt-ie9')) {
                options = {
                    series: [{
                            color: 'purple',
                            data: []
                        }],
                    chart: {
                        height: 300,
                        width: 180,
                        marginBottom: 95
                    },
                    xAxis: {
                        categories: [],
                        labels: {
                            rotation: t,
                            style: {
                                color: '#262626',
                                fontWeight: 'normal',
                                fontSize: '10px',
                                fontFamily: 'courier',
                            }
                        }
                    },
                    tooltip: {
                        style: {
                            color: '#262626',
                            fontWeight: 'normal',
                            fontSize: '9px',
                            fontFamily: 'courier',
                            padding: '2px',
                        },
                        hideDelay: 100,
                        formatter: function () {
                            return '<div style="width: 135px;">' + this.x + '<br/>' + this.y + '</div>';
                        }
                    },
                    yAxis: {
                        title: {
                            text: null
                        },
                        labels: {
                            style: {
                                color: '#262626',
                                fontWeight: 'normal',
                                fontSize: '10px',
                                fontFamily: 'courier',
                            }
                        }
                    },
                    legend: {
                        enabled: false
                    }
                };
            }
            else {
                options = {
                    series: [{
                            color: 'purple',
                            data: []
                        }],
                    chart: {
                        height: 300,
                        width: 224,
                        marginBottom: 95
                    },
                    xAxis: {
                        categories: [],
                        labels: {
                            rotation: t,
                            style: {
                                color: '#262626',
                                fontWeight: 'normal',
                                fontSize: '12px',
                                fontFamily: 'courier',
                            }
                        }
                    },
                    tooltip: {
                        style: {
                            color: '#262626',
                            fontWeight: 'normal',
                            fontSize: '12px',
                            fontFamily: 'courier'
                        },
                        hideDelay: 100,
                        formatter: function () {
                            return '<div style="width: 135px;">' + this.x + '<br/>' + this.y + '</div>';
                        }
                    },
                    yAxis: {
                        title: {
                            text: null
                        },
                        labels: {
                            style: {
                                color: '#262626',
                                fontWeight: 'normal',
                                fontSize: '12px',
                                fontFamily: 'courier',
                            }
                        }
                    },
                    legend: {
                        enabled: false
                    }
                };
            }
            $.each(data, function (i, item) {
                options.xAxis.categories.push(data[i].viewByShortName);
            });
            $.each(data, function (i, item) {
                options.series[0].data.push(data[i].cwCount);
            });
        } else {
            $('#chart-column-cw').html("<div><span class='no_graph'>" + err_msg + "</span></div>");
        }
    };
    /* Function defined for CW ends here */

    /* Function defined for CW TOS starts here*/
    insertDataContigentWorkerTOS = function (data, successFlag, id) {
        if ($.trim(data).length > 0 && successFlag) {
            var t, options;
            switch (id) {
                case 0:
                    t = parseInt(band_angular, 10);
                    break;
                case 1:
                    t = parseInt(country_angular, 10);
                    break;
                case 2:
                    t = parseInt(function_angular, 10);
                    break;
            }
            if ($('html').hasClass('lt-ie9')) {
                options = {
                    series: [{
                            color: '#0B2161',
                            data: []
                        }],
                    chart: {
                        height: 300,
                        width: 200,
                        marginBottom: 95,
                        spacingLeft: 15
                    },
                    xAxis: {
                        categories: [],
                        labels: {
                            rotation: t,
                            style: {
                                color: '#262626',
                                fontWeight: 'normal',
                                fontSize: '10px',
                                fontFamily: 'courier',
                            }
                        }
                    },
                    tooltip: {
                        style: {
                            color: '#262626',
                            fontWeight: 'normal',
                            fontSize: '9px',
                            fontFamily: 'courier',
                            padding: '2px',
                        },
                        hideDelay: 100,
                        formatter: function () {
                            return '<div style="width: 135px;">' + this.x + '<br/>' + this.y + '</div>';
                        }
                    },
                    yAxis: {
                        title: {
                            text: null
                        },
                        labels: {
                            style: {
                                color: '#262626',
                                fontWeight: 'normal',
                                fontSize: '10px',
                                fontFamily: 'courier',
                            }
                        }
                    },
                    legend: {
                        enabled: false
                    }
                };
            }
            else {
                options = {
                    series: [{
                            color: '#0B2161',
                            data: []
                        }],
                    chart: {
                        height: 300,
                        width: 235,
                        marginBottom: 95,
                        spacingLeft: 5
                    },
                    xAxis: {
                        categories: [],
                        labels: {
                            rotation: t,
                            style: {
                                color: '#262626',
                                fontWeight: 'normal',
                                fontSize: '12px',
                                fontFamily: 'courier',
                            }
                        }
                    },
                    tooltip: {
                        style: {
                            color: '#262626',
                            fontWeight: 'normal',
                            fontSize: '12px',
                            fontFamily: 'courier'
                        },
                        hideDelay: 100,
                        formatter: function () {
                            return '<div style="width: 135px;">' + this.x + '<br/>' + this.y + '</div>';
                        }
                    },
                    yAxis: {
                        title: {
                            text: null
                        },
                        labels: {
                            style: {
                                color: '#262626',
                                fontWeight: 'normal',
                                fontSize: '12px',
                                fontFamily: 'courier',
                            }
                        }
                    },
                    legend: {
                        enabled: false
                    }
                };
            }
            $.each(data, function (i, item) {
                options.xAxis.categories.push(data[i].viewByShortName);
            });
            $.each(data, function (i, item) {
                options.series[0].data.push(data[i].cwCount);
            });
        } else {
            $('#chart-col-cw-tos').html("<div><span class='no_graph'>" + err_msg + "</span></div>");
        }
    };
    /* Function defined for CW TOS ends here */
    function drawChart(url, callback, id) {
        //console.log("id-->"+id);
        //console.log("url-->"+url);
        $.ajax({
            url: url,
            dataType: "json",
            contentType: "application/json",
            success: function (data, flag) {
                //console.log("data-->"+data);
                if (data.statuscode != undefined && data.statuscode == "OUTAGE") {
                    errorHandler('#hrdashboad_pad', data);
                } else {
                    callback(data, true, id);
                }
            },
            complete: function (data) {
                $("#vac-chart-loading-img").fadeOut(1800, function () {
                    $("#chart-column-vacancies").removeClass("hide");
                    $("#vac-chart-loading-img").addClass("hide");
                });
                $("#ex-chart-loading-img").fadeOut(1800, function () {
                    $("#chart-column-exits").removeClass("hide");
                    $("#ex-chart-loading-img").addClass("hide");
                });
                $("#hc-chart-loading-img").fadeOut(1800, function () {
                    $("#chart-column-headcount").removeClass("hide");
                    $("#hc-chart-loading-img").addClass("hide");
                });
                // CW dashboard changes.
                $("#cw-chart-loading-img").fadeOut(1800, function () {
                    $("#chart-column-cw").removeClass("hide");
                    $("#cw-chart-loading-img").addClass("hide");
                });
                $("#tos-chart-loading-img").fadeOut(1800, function () {
                    $("#chart-col-cw-tos").removeClass("hide");
                    $("#tos-chart-loading-img").addClass("hide");
                });

                if($('.dropdown-menu.cw-dropdown-menu li[selected=selected]').hasClass('yppl')){
                    $('.dashboard-charts-view').next().attr('data-load', 'true');
                }else{
                    $('.dashboard-charts-view').next().next().attr('data-load', 'true');
                }
            },
            error: function (e) {
                //console.log("e-->"+e);
                callback(e, false, 0);
            }
        });
    }


    $('body').on('click', ".head-count-charts ul li", function (e) {
        if(!$(this).hasClass('cms-linkfile-info')){
        e.preventDefault();
        var current_id, ary_id;
        current_id = this.id;
        ary_id = current_id.split('-');
        getChart(ary_id[1], ary_id[2]);
    }
    });

    $('body').on('click', 'ul.dropdown-menu li', function () {
        $(this).addClass('highchart-menu-active').siblings().removeClass('highchart-menu-active');
    });
 
    $('body').on('click', '.dashboard-charts-view', function(){
        var selected_role = "";
        if (role.indexOf("HRM") > -1) {
            selected_role = $('.hr_roles_dropdown li#hr_role[selected=selected] a').attr('value');
        }else if (role.indexOf("MGR") > -1){
             if (role.indexOf(',') > -1) {
                selected_role = role.slice(0, role.indexOf(","));
            } else {
                selected_role = role;
            }
        }

        dashboard_graph(selected_role);

        if($('.dropdown-menu.cw-dropdown-menu li[selected=selected]').hasClass('yppl')){
            $(this).next().toggleClass('hide-charts');
            if($(this).next().attr('data-load') == "false"){
                drawChart(Set1[0], insertDataHeadCount, 0);
                drawChart(Set2[0], insertDataExit, 0);
                drawChart(Set3[0], insertDataVacancy, 0);
            }
        }else{
            $(this).next().next().toggleClass('hide-charts');
            if($(this).next().next().attr('data-load') == "false"){
                drawChart(Set4[0], insertDataContigentWorkerTOS, 0);
                drawChart(Set5[0], insertDataContigentWorker, 0);
                showCMSContent(glbDSWSCmpURL + 'WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_GE_EDS_DRWSLandingPage', 'nodeUrlValue=8824', "#cw_graph_3", null, true);
            }
        }

        $(this).children('.icon-ico_chevron_down_lg').toggleClass('icon-rotate-180');
    });

    /** summary stats url**/
    function summary_statistics(hrm_role, ischanged) {
        var id, dashboard_url, head_count, addedhead_count, pendingadds_count, suspends_count, leaving_count, exits_count;
        if (role.indexOf("HRM") > -1) {
            //id = hrm_role.split('role=')[1].split('&')[0];
            id = hrm_role;
            //console.log(role+"2222222222222");
        }
        else if (role.indexOf("MGR") > -1) {
            var selected_role = "";
            if (role.indexOf(',') > -1) {
                selected_role = role.slice(0, role.indexOf(","));
            } else {
                selected_role = role;
            }
            id = selected_role;
        }
        $("#GE_HR_DASHBOARD").css("display","block");
       if ($("#cw-outage").length > 0){
             $("#cw-outage").remove();
         }

                    if($("#people-db-container").length>0){
                        $("#people-db-container").remove();
                    }
					/* loadTemplates*/
					if(glbSiteName === "GE_HRVIEW"){
						cardContainer = new EJS({url: '/m/eds/hrview/templates/client_list/card_container.ejs?v='+glbFileVerNo}).render();
                        $("#GE_HR_DASHBOARD").append(cardContainer);
                        roleSelector = new EJS({url: '/m/eds/hrview/templates/client_list/role_template.ejs?v='+glbFileVerNo}).render();
                        $("#card-container-collapse").append(roleSelector);

						for (i = 0; i < globalRole.length; i = i + 1) {
							if (globalRole[i].role !== '') {
								if (i === 0) {
									$('#card-hr-role-list').append('<li id="hr_role" selected="selected"><a value="' + globalRole[i].role + '">' + global_hrm_dashboard[globalRole[i].role] + '</a></li>');
								} else {
									$('#card-hr-role-list').append('<li id="hr_role"><a value="' + globalRole[i].role + '">' + global_hrm_dashboard[globalRole[i].role] + '</a></li>');
								}
							}
						}
						$('.hr_roles_dropdown .first_role').attr("alt", global_hrm_dashboard[globalRole[0].role]).html(global_hrm_dashboard[globalRole[0].role]);
					}
					if(glbSiteName === "GE_MNGRVIEW"){
					   cardContainer = new EJS({url: '/m/eds/hrview/templates/client_list/mgr_card_container.ejs?v='+glbFileVerNo}).render();
					   $("#GE_HR_DASHBOARD").append(cardContainer);
					}
                    newClientList();


        /*Assing event onClick */
   function headcount_linkFnExec(clientList,data){
        head_count = data.headCount;
        addedhead_count = data.addedEmpCount;
        pendingadds_count = data.pendingAddsCount;
        suspends_count = data.suspendsCount;
        leaving_count = data.leavingCount;
        exits_count = data.exitsCount;

        $("#headcount_link"+clientList).bind('click', function () {
            dashboardCountData('GE_HR_HRPOPULATION_GET', 'HeadCount', head_count, id, '', 'HR');
        });
        $("#added_link"+clientList).bind('click', function () {
            dashboardCountData('GE_HR_HRPOPULA_ADD_GET', 'Added', addedhead_count, id, '', 'HR');
        });
        $("#pendingadds_link"+clientList).bind('click', function () {
            dashboardCountData('GE_HR_POPULA_PENDADD_GET', 'pending Adds', pendingadds_count, id, '', 'HR');
        });
        $("#suspends_link"+clientList).bind('click', function () {
            dashboardCountData('GE_HR_POPULA_SUSPENDS_GET', 'Suspends', suspends_count, id, '', 'HR');
        });
        $("#leaving_link"+clientList).bind('click', function () {
            dashboardCountData('GE_HR_HRPOPULA_LEAVE_GET', 'leaving', leaving_count, id, '', 'HR');
        });
        $("#exits_link"+clientList).bind('click', function () {
            dashboardCountData('GE_HR_HRPOPULA_EXITS_GET', 'Exits', exits_count, id, '', 'HR');
        });
   }

    /* new client list */
    function newClientList(){

                /*temp fix*/
                $("#GE_HR_DASHBOARD .feature.c-collapsable.pay-portlet.tour_widget_desc").css("display","none");
                //$("#card-container-collapse").empty();
                $("#GE_HR_DASHBOARD").prepend("<div class='communication-loading-widget text-center'><img src='/m/eds/img/ajax-loader.gif'/></div>");
                /**********/
                 var domain = glbDSWSCmpURL.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i);

                 //var empJson=glbDSWSCmpURL + "WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_GetJsonData?serviceOp=GE_HR_SUMMARYSTATS_GET&addHeader=GE_SENTRY&role="+hrm_role;
                 //var CW_billable=glbDSWSCmpURL + "WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_GetJsonData?serviceOp=GE_HR_DASH_CWWORKER_COUNT_GET&addHeader=GE_AKANA&hierFacets=cwBillableFlag&role="+hrm_role;
                 /*uncomment in case API doesnt work */
                 empJson=domain[0] + "m/eds/hrview/json_example/employee.json";
                 CW_billable=domain[0] + "m/eds/hrview/json_example/CW_billable_sample_json.json";
                $.when(
                    $.getJSON(empJson),
                    $.getJSON(CW_billable)
                ).done(function(employee,CW_billable) {
                    var billableObj={},nonBillableObj={},employeeObj={},wordsInArr=[],listWorkers=[],objRender={},contrArr=[],nonGEArr=[],empClean=[],roleDashboard={};
                    var displayGraph=CW_billable[0].displayGraph
                    //feed role select
                    $("#card-hr-role-list li a").each(function(index,key){
                        if($(this).attr("value")==employee[0].role){
                            $("#people-db-container .hr_roles_dropdown .first_role").text($(this).text());
                        }
                    });

                    //validate API empty or without results
                    validateAPI= new validateObject(CW_billable);
                    emptyAPI=validateAPI.validateAttribute('facetHierarchyResult');
                    if(emptyAPI===true){ return false;}
                    empCleanItems = new replaceLabelEmp(employee[0]);
                    empCleanItems.replacingLabel();
                    //empCleanItems.addItemsEmp();
                    empCleanItems.orderByValAsc();
                    empClean=empCleanItems.returnVal();
                    /*validate empty*/
                    billableTmpObj = new getArrList("Billable Workers",CW_billable[0].facetHierarchyResult[0].subList);
                    billableTmpObj.validateEmpty();
                    billableTmpObj.getArrarEmpType();
                    billableObj.items=billableTmpObj.getResult();
                    /*MAPPING BILLABLE*/
                    mapBillable = new replaceLabelEmp(billableObj.items.subList);
                    mapBillable.replacingLabelGlobal();
                    mapBillable.addItems();
                    mapBillable.orderByValAsc();
                    billableObj.items.subList= mapBillable.returnVal();

                    nonBillableTmpObj=new getArrList("Non-Billable Workers",CW_billable[0].facetHierarchyResult[0].subList);
                    nonBillableTmpObj.validateEmpty();
                    nonBillableTmpObj.getArrarEmpType();
                    nonBillableObj.items=nonBillableTmpObj.getResult();
                    /*MAPPING NONBILLABLE*/
                    mapNonBillable = new replaceLabelEmp(nonBillableObj.items.subList);
                    mapNonBillable.replacingLabelGlobal();
                    mapNonBillable.addItems();
                    mapNonBillable.orderByValAsc();
                    nonBillableObj.items.subList= mapNonBillable.returnVal();

                    billableObj.id="cnrt",
                    //billableObj.title=billableObj.items.label
                    billableObj.title="Billable Contingent Workers";
                    billableObj.urlVal="Billable Workers";
                    billableObj.value=formatNumber(billableObj.items.value);
                    nonBillableObj.id='nng';
                    //nonBillableObj.title=nonBillableObj.items.label;
                    nonBillableObj.title="Non-Billable Contingent Workers";
                    nonBillableObj.urlVal="Non-Billable Workers";
                    nonBillableObj.value=formatNumber(nonBillableObj.items.value);
                    employeeObj={"id":"emp","title":"GE Employees","value":employee[0].headCount,eventFn:"fnToggle()"}

                    formNumBill = new formatInfo(billableObj.items);
                    formNumBill.interateArray();
                    billableObj.items=formNumBill.getResult();


                    formNumNonBill = new formatInfo(nonBillableObj.items);
                    formNumNonBill.interateArray();
                    formNumNonBill.items=formNumNonBill.getResult();

                    employeeObj.subList=empClean;
                    var arrGraph=[billableObj,nonBillableObj,employeeObj];
                    if(employee){
                        htmlEmployee = new EJS({url: '/m/eds/hrview/templates/client_list/employee.ejs?v='+glbFileVerNo}).render(employeeObj);
                        $("#left-section").append(htmlEmployee);
                    }
                    if(billableObj.items.value!=0){
                        htmlContr = new EJS({url: '/m/eds/hrview/templates/client_list/billable.ejs?v='+glbFileVerNo}).render(billableObj);
                        $("#left-section").append(htmlContr);
                    }
                    if(nonBillableObj.items.value!=0){
                        htmlNonGE = new EJS({url: '/m/eds/hrview/templates/client_list/nonbillable.ejs?v='+glbFileVerNo}).render(nonBillableObj);
                        $("#left-section").append(htmlNonGE);
                    }
                    /*modal*/
                    modalAlert = new EJS({url: '/m/eds/hrview/templates/client_list/modal.ejs?v='+glbFileVerNo}).render({headerText:'Error',messageText1:'This feature is currently unavailable.',messageText2:''});

                    $("#card-container-collapse").append("<div id='client_list_container' class='span4'></div>");
                    $("#client_list_container").append(htmlEmployee);
                    if(billableObj.value!=0){   $("#client_list_container").append(htmlContr);}
                    if(nonBillableObj.value!=0){   $("#client_list_container").append(htmlNonGE);}

                    $("#portlet-GE_HRVIEW_SIDEBAR").append(modalAlert);


                    $(".card_link").bind('click', function () {
                        //dashboardCountData('GE_HR_HRPOPULATION_GET', 'HeadCount', head_count, id, '', 'HR');
                        var card_desc={};
                        card_desc.title=$(this).attr("data-emp-title");
                        card_desc.card_name=$(this).attr("data-card-name");
                        card_desc.api=$(this).attr("data-emp-api");
                        var card_count=$(this).attr("data-emp-count");
                        dashboardCountData('GE_HR_DASH_CWWORKER_GET', 'cwclist', card_count, hrm_role, card_desc, 'CW',card_desc.card_name);
                    });
                    /*add click event*/
                     headcount_linkFnExec('_new',employee[0]);
                    //add events to templates after to render
                    addEvents();
                    if(displayGraph=='Y'){ createGraph(billableObj.items,nonBillableObj.items,employeeObj.value.replace(",",""));}else{
                        $("#client_list_container").addClass("no-graph");
                    }
                    /*Adding definition pop-up */
                    $("#GE_HR_DASHBOARD .communication-loading-widget").remove();
            }).fail(function(employee){
                handleError=new handleErrors(employee.responseText);
                handleError.cleanErrorString();
                var MessObj={};
                MessObj.errorMessage=handleError.getErrorString();;
                var valObj= new errorHandleNewApi("#people-db-container",MessObj);
                    valObj.displayError();
            });
        }

    /*create graph*/
    function createGraph(arrContr,arrNonGE,empCount){
        var billContractor=0,billNonGE=0,GEworker=0,result=0,empTotal=0,cntrSum=0,result=0,chartNoFill=0,totalCal=0,geWorkersNum=0,noFillNum=0;

        /*cntrSum  = new SumGraph(arrContr.subList);
        billContractor=cntrSum.getSumGraph();
        nonGeSum = new SumGraph(arrNonGE.subList);
        billNonGE=nonGeSum.getSumGraph();*/

        calcFormula= new calculateFormula(arrContr.value,billNonGE,empCount);
        calcFormula.calculate();
        calcFormula.validate();
        result=Math.round(calcFormula.getResult());
        chartNoFill=100-result;
        geWorkersNum=new Intl.NumberFormat().format(empCount);
        noFillNum= new Intl.NumberFormat().format(arrContr.value);

        htmlGraph = new EJS({url: '/m/eds/hrview/templates/client_list/graph.ejs?v='+glbFileVerNo}).render({"graph":1,"geWorkers":result,"geWorkersNum":geWorkersNum,"noFill":chartNoFill,"noFillNum":noFillNum});
        $("#card-container-collapse").append(htmlGraph);

        var ctx = document.getElementById("myChart");
        ctx.height = 50;
        data={
            labels:['GE Workers','Billable Workers'],
            datasets:[{
                backgroundColor:['#348acd','#e0dedf'],
                data:[result,chartNoFill]
            }]
        };
        //unfilled color #e0dedf
        options={
            responsive:true,
            cutoutPercentage:80,
            animation:{

                easing:'easeInCirc',
                duration:3000
            },
            legend:{
                display:false,
                position:'bottom',
                labels: {
                    boxWidth:10,
                        }
            },
            elements: {
              center: {
                text: result+"%",
                fontColor: '#348acd',
                fontSize: 20,
                fontStyle: 'normal'
              }
            },
            tooltips: {
                enabled:false
            }
            }
        var myChart = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: options
        });
}
       /*functions*/
       function  formatNumber(num) {
        return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
     }
        function formatInfo(arr){
            this.arr=arr;

            this.interateArray=function(){
                for(i=0;i<this.arr.subList.length;i++){
                    this.arr.subList[i].value=this.formatNumber(this.arr.subList[i].value);
                }
            }

            this.formatNumber=function(num) {
                return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
             }

             this.getResult=function(){
                 return this.arr;
             }

        }
        function eachList(arrJson,listBill){
                this.arrJson=arrJson;
                var arrList=[];
                $.each(this.arrJson, function( index, value ) {
                       var billIndex = listBill.map(function(data) {return data; }).indexOf(value.label);
                       var billVal=(billIndex!=-1)?1:0;
                       arrList.push({"tWorker":value.label,"value":value.value,"bill":billVal});
                 });
                this.returnVal=function(){
                    return  arrList;
                }
        }
        function validateObject(arr){
            this.arr=arr;
            this.res;

            this.validateEmpty=function(){
                this.res=(this.arr.subList.length===0)?{"value":0,"subList":0}:this.arr;

            }
            this.validateArrPattern=function(){
                if(arr.value===0){
                    this.res={"value":0,"subList":0};
                }
            }
            this.validateAttribute=function(item){
                var valid=false;
                if(arr.totalResultCount===0 || arr[0][item]===undefined){
                    var valObj= new errorHandleNewApi("#GE_HR_DASHBOARD",{errorMessage:'The API does not have results'});
                    valObj.displayError();
                    valid=true;
                }
                return valid;
            }
            this.returnVal=function(){
                return this.res;
            }
        }
        function errorHandleNewApi(div,error){
            this.error=error;
            this.div=div;
            this.displayError=function(){
                $(this.div).append("<div class='well no-content'>"+this.error.errorMessage+"</div>");
                $("#GE_HR_DASHBOARD .communication-loading-widget").remove();
            }

        }

        function getArrList(empType,arr){
            this.empType=empType;
            this.arr=arr;
            var returnVal,empTypeFlag=false;
            //var empTypeFlag=false;
            this.validateEmpty=function(){
                for(x=0;x<this.arr.length;x++){
                    if(this.arr[x].label==empType){
                        empTypeFlag=true;
                    }
                 }
                }

             this.getArrarEmpType=function(){
                if(empTypeFlag===false){ returnVal={"value":0,"subList":0}; return false;}
                for(i=0;i<arr.length;i++){
                    if(arr[i].label==empType){
                        validateArr= new validateObject(arr[i]);
                        validateArr.validateEmpty();
                        returnVal=validateArr.returnVal();
                    }
                }
             }
             this.getResult=function(){
                 return returnVal;
             }
        }

        function SumGraph(arrTypeBill){
            this.arrTypeBill=arrTypeBill;
            count=0;
                for(ii=0;ii<this.arrTypeBill.length;ii++){
                        count=parseInt(count) + parseInt(this.arrTypeBill[ii].value);
                }

            this.validateEmptyResult=function(){
                 count=(count==0)?100:count;
            }
            this.getSumGraph=function(){
                return count;
            }
        }
        function calculateFormula(billContractor,billNonGE,empCount){
            this.billContractor=billContractor;
            this.billNonGE=billNonGE;
            this.empCount=empCount;
            var calc1=0,calc2=0,result=0;
            var calc1=parseInt(this.billContractor) + parseInt(this.empCount);
            var calc2=parseInt(this.empCount)/calc1;

            this.calculate=function(){
                result=calc2*100;
            }

            this.validate=function(){
                result=((billContractor==0) && (billNonGE==0))?100:result;
            }

            this.getResult=function(){
                return result;
            }
            this.billWorkersNum=function(){
                return parseInt(this.empCount) + parseInt(this.billContractor);
            }
      }
        function validateSubList(obj){
            //var res=(arr.subList=="undefined")?arr.subLis=[{"label":type,value:0}]:arr;
            if(arr.value==0){
                $("GE_HR_DASHBOARD").append("<div><label>The API call "+type+" doesn't have results</label></div>");
                return false;
            }

        }
        function replaceLabelEmp(arr){
            this.arr=arr;
            this.newEmpArr=[];
            var empLabel=[{'new_label':'Overall FTE Headcount','old_label':'headCount','link':'headcount_link_new'},{'new_label':'Adds','old_label':'addedEmpCount','link':'added_link_new'},{'new_label':'Pending Adds','old_label':'pendingAddsCount','link':'pendingadds_link_new'},{'new_label':'Suspends','old_label':'suspendsCount','link':'suspends_link_new'},{'new_label':'Leaving','old_label':'leavingCount','link':'leaving_link_new'},{'new_label':'Exits','old_label':'exitsCount','link':'exits_link_new'},{'new_label':'Minority JV','old_label':'Minority Jv'},{'new_label':'SOW','old_label':'Sow'},{'new_label':'SOW Core','old_label':'Sow Core'},{'new_label':'SOW Non-Core','old_label':'Sow Non-Core'}];
            /*Deleting items*/
            delete this.arr.sso;
            delete this.arr.summaryReportingNonGE;
            delete this.arr.role;

            this.replacingLabel=function(){

                for(key in this.arr){
                    for(key2 in empLabel){
                        if(key==empLabel[key2].old_label){
                            var lbl=empLabel[key2].new_label;
                            //lbl = lbl.charAt(0).toUpperCase()+lbl.slice(1).toLowerCase();
                            this.newEmpArr.push({label:lbl,value:this.arr[key],link:empLabel[key2].link,apiValue:empLabel[key2].old_label});
                        }
                    }
                }
            }
            this.replacingLabelGlobal=function(){
                                for(key in this.arr){
                                    for(key2 in empLabel){
                                        if(this.arr[key].label==empLabel[key2].old_label){
                                            var lbl=empLabel[key2].new_label;
                                            //lbl = lbl.charAt(0).toUpperCase()+lbl.slice(1).toLowerCase();
                                            this.newEmpArr.push({label:lbl,value:this.arr[key].value,apiValue:empLabel[key2].old_label});

                                }
                            }
                        }
                    }

            this.findElem=function(item){
                this.newEmpArr.some(function(e){
                    return item===e;
                });
            }
            this.addItems=function(){
                for(arrKey in this.arr){
                    var element=this.arr[arrKey];
                    var resIndexOf= this.newEmpArr.some(function(e){ return (element.label.toLowerCase()==e.label.toLowerCase() && element.value==e.value); });
                    if(resIndexOf===false){
                         var lbl=this.arr[arrKey].label;
                         //lbl = lbl.charAt(0).toUpperCase()+lbl.slice(1).toLowerCase();
                        this.newEmpArr.push({label:lbl,value:this.arr[arrKey].value,apiValue:lbl});
                    }
                }
            }

            this.addItemsEmp=function(){
                for(key in this.arr){
                        var element=key;
                        var resIndexOf= this.newEmpArr.some(function(e){ return (element.toLowerCase()==e.label.toLowerCase() && element.value==e.value); });
                        if(resIndexOf===false){
                             var lbl=element;
                            this.newEmpArr.push({label:lbl,value:this.arr[key]});
                        }
                 }
            }

            this.orderByNameAsc=function(){
                this.newEmpArr=this.newEmpArr.sort(function(a,b){ return a.label > b.label  });
            }

            this.orderByNameDesc=function(){
                this.newEmpArr=this.newEmpArr.sort(function(a,b){ return a.label < b.label });
            }

            this.orderByValAsc=function(){
                this.newEmpArr=this.newEmpArr.sort(function(a,b){ return b.value - a.value  });
            }
            this.orderByValDesc=function(){
                this.newEmpArr=this.newEmpArr.sort(function(a,b){ return a.value - b.value  });
            }
            this.returnVal=function(){
                return this.newEmpArr;
            }
        }

        function addEvents(){

              $(".panel-title").on("hidden",function(){
                    //$('.collapse').collapse('hide');
                    $(this).parent().find(".icon-arrow-cid").toggleClass("icon-ico_chevron_down_lg icon-ico_chevron_up_lg");
                }).on("show",function(){
                    //$('.collapse').collapse('hide');
                    $(this).parent().find(".icon-arrow-cid").toggleClass("icon-ico_chevron_down_lg icon-ico_chevron_up_lg");
                });/*Please improve this part of the code to avoid duplicate selectors, for soft release its good for now atte: Omar Davila*/

                $(".header-section.auto-collapse").click(function(){
                    $('.panel-collapse.in').collapse('hide');
                });

              $(".panel-body .filter-button a").click(function(){
                    /*This function need to be improved please dont leave as is it*/
                    var option=($(this).attr("id"));
                    addBehavior(option);
                    if(option=="all"){ $(".panel-body .nonGEList li").show();  return false;}

                    $(".panel-body .nonGEList li").hide();
                    $(".panel-body .nonGEList .bill"+option).show()
              });
                function addBehavior(option){
                    $(".panel-body .filter-button a").removeClass("btn-primary").addClass("inactive");
                    $(".panel-body .filter-button #"+option).addClass("btn-primary");
                }
                $("#GE_HR_DASHBOARD .header-card-section").click(function(){
                    $(this).find(".icon-arrow-cid").toggleClass("icon-ico_chevron_down_lg icon-ico_chevron_up_lg");
                });
                /**remove href link */
                $("#GE_HR_DASHBOARD .GA").click(function(event){ event.preventDefault(); });

                /**Definitions */
                $("#definitions-btn").click(function(){
                    var definitions={};
                    definitions.definition=[
                        {'header':'GE Employees:','list':[
                            {'title':'Overall FTE Headcount:','desc':'Current headcount based upon the standard, pre-existing headcount definitions'},
                            {'title':'Adds:','desc':'YTD count of employees who have been added to your population as of the reporting date (hires & status changes in). Transfers not included.'},
                            {'title':'Pending Adds:','desc':'Any of your candidates with an assigned SSO ID and a future start date in OHR. Transfers not included.'},
                            {'title':'Suspends:','desc':'Any of your employees currently on a suspend status in OHR'},
                            {'title':'Leaving:','desc':'Any of your employees identified in OHR with a future dated end employment record (leaving the company)'},
                            {'title':'Exits:','desc':'YTD count of your employees who have left GE (resignations, GE initiated, retired). Transfers not included.'}
                            ]
                        },
                        {'header':'Contingent Workers:','list':[
                            {'title':'Leased Workers:','desc':'Individuals employed by a 3rd party agency and supplied on a temporary basis to GE'},
                            {'title':'Independent Contractors:','desc':' Self-employed individuals who provide specialized services or expertise to GE and other companies'},
                            {'title':'Customer:','desc':'Individual who pays for GE products/services and has a working relationship with GE'},
                            {'title':'Supplier:','desc':'Includes Joint Ventures, partners, supplier account managers'},
                            {'title':'Minority JV:','desc':'Employees or Contingent Workers of a Joint Venture requiring access to GE systems under the terms of the Joint Venture'},
                            {'title':'Divested Entity Worker:','desc':' Person working for a divested GE entity or acquiring entity who requires access to a GE site or system under the Transition Services Agreement'},
                            {'title':'SOW – Non-Core:','desc':'  Workers provide services pursuant to a Purchase Service Agreement with an outside contractor, whereby worker provides services not performed by GE or core to serving its customers (e.g. cafeteria services)'},
                            {'title':'SOW – Core:','desc':'Workers perform services relative to a well-defined scope of work through a Purchase Service Agreement with an external vendor.   Vendor is supplying workers to provide a well-defined scope of work that is similar to work done by GE workers in core competency areas of a GE business (e.g. IT support)'}
                         ]}
                    ];
                    if($("#definitions_ge").length===0){
                        definitionsModal = new EJS({url: '/m/eds/hrview/templates/client_list/definitions-ge.ejs?v='+glbFileVerNo}).render(definitions);
                        $("#portlet-GE_HRVIEW_SIDEBAR").append(definitionsModal);
                    }


                });
        }

        function handleErrors(data){ /*this funcion should be a global function*/
            this.data=data;
            var showContent='';
            var cleanString=data.replace(/{|}|"/g,"").split(","); //Clean up the malformed JSON removing the following symbols "{" or "}" or " " ", using "/g" at the end to replace all symbols in one string )
            this.cleanErrorString=function(){
                cleanString.forEach(function(elemnt){ /*forEach to see all arrays*/
                    if(elemnt.indexOf("exceptiondisplaymsg")!=-1){/* if an arrar contains the word "exceptiondisplaymsg"*/
                        errorMessage=elemnt.split(":"); /*split it to get only the description*/
                        showContent=errorMessage[1];
                    }
                });
            }
            this.getErrorString=function(){
                    return showContent;
            }
        }

        function handleViews(globalSite){
            this.globalSite=globalSite;
            this.dashboardClientList=function(eInsert,afterOf){
                if(this.globalSite=="GE_HRVIEW"){ /*insert div after of*/
                    $("#"+eInsert).insertAfter("#"+afterOf);
                }
            }
            this.getCurrentSite=function(){
               return this.globalSite;
            }
        }

        /*Chart.js plugin text center*/
        Chart.pluginService.register({
            afterDraw: function(chart) {
              if (chart.config.options.elements.center) {
                var helpers = Chart.helpers;
                var centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
                var centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;

                var ctx = chart.chart.ctx;
                ctx.save();
                var fontSize = helpers.getValueOrDefault(chart.config.options.elements.center.fontSize, Chart.defaults.global.defaultFontSize);
                var fontStyle = helpers.getValueOrDefault(chart.config.options.elements.center.fontStyle, Chart.defaults.global.defaultFontStyle);
                var fontFamily = helpers.getValueOrDefault(chart.config.options.elements.center.fontFamily, Chart.defaults.global.defaultFontFamily);
                var font = helpers.fontString(fontSize, fontStyle, fontFamily);
                ctx.font = font;
                ctx.fillStyle = helpers.getValueOrDefault(chart.config.options.elements.center.fontColor, Chart.defaults.global.defaultFontColor);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(chart.config.options.elements.center.text, centerX, centerY);
                ctx.restore();
              }
            },
          });

    }
    
    function summaryStatError(data) {
        $("#dashboard-loading-img").addClass("hide");
        if (data.responseText) {
            var resp = data.responseText.replace("\"{", "{").replace("\"}", "}").replace(/(\r\n|\n|\r)/gm, ""), response;
            response = JSON.parse(resp);
            $('#hrdashboad_pad').closest(".block").html('<div class="well no-content">' + response.exceptiondisplaymsg + '</div>').css('padding', '20px');
        } else {
            $('#hrdashboad_pad').closest(".block").html('<div class="well no-content">' + data.statusmesssage + '</div>').css('padding', '20px');
        }
    }

    function dashboardCountData(serverOpr, clicktype, count, role, title, list_type, service_type) {
        var dashboard_url;
        if (list_type === "HR") {
            dashboard_url = glbDSWSPspURL + 'WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_getHRClientListHTML?isAjax=true&serviceOpr=' + serverOpr + '&clicktype=' + clicktype + '&count=' + count + '&role=' + role;
        } else if (list_type === 'CW') {
                dashboard_url = glbDSWSPspURL + 'WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_getHRCWClientListHTML?isAjax=true&serviceOpr=' + serverOpr + '&clicktype=' + clicktype + '&count=' + count + '&role=' + role + '&title=' + title.title + '&pagesize=10&stype="' + service_type+'"&q=cwWorkerSubType:"'+title.api+'" AND cwBillableFlag:"'+title.card_name+'"';
				//console.log("dashboard_url:"+dashboard_url)
        }
        $('#dashboard_count_data_form').attr('action', dashboard_url);
        document.dashboard_count_data.submit();
    }
}

if (typeof (isHRDashboard) != "undefined") {
    hrm_dashboard();
}

ge_calendar = function () {
    function call_calendar() {
    var page_location, calendar_ids, calids, calendar_id, get_events_url, events_date_url, events_details_url, deeplink_to_calendar, deeplink_to_event, deeplink_to_day, calendarID, timeOutMsg, failMsg, calendarPersonID, timezoneOffset, itemCount, firsthit, dateFormat, timeFormat, includeSubscribedEvents, includeCanceledEvents, daylightStartDate, daylightStartTime, daylightTimezoneOffset, startDateOffset, endDateOffset, previousmonthtrue, pagecounter, upcomingeventdate, currentmonth, currentyear, clickrefresh, prevMonth, prevYear, eventDetailsXML, previousmonthistrue, startDateMonth, endDateMonth, isGuestCalendar, EventBufferArray, partial, partialHtml, dayNamesMin, date, year, month, getEventsURL, eventsForDateURL, eventDetailsURL, bubbleEventsForDateHTML, bubbleEventsForDateIsOpened, bubbleEventDetailsHTML, element, bubbleTemplates, username, subscribe_event_url, export_event_url, calendarid, targetting_switch, export_outlook_statictext, exporteventtooutlookObj1, exporteventmodaltitleObj1, exporteventmodalcontentObj1, subscribe_eventID, todayDate, bubbleDateEvent, offsetValue;
    content = settings.calendarJson.calendar;
    subscribe_event_url = glbDSWSCmpURL + "WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_GE_cal_subscribe";
    export_outlook_statictext = content.export_outlook_statictext;
    export_event_url = glbDSWSCmpURL + "WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_GE_cal_export";
    username = content.username;
    //calendar_ids = content.calendar_ids;
    calendarid = content.calendar_id;
    page_location = content.pageclick;
    targetting_switch = content.targetting_switch;
    //calids = calendar_ids.replace(/\s/g, "")
    //calendar_id = calids.split(",");
    //calendarID = calendar_id;
    get_events_url = glbDSWSCmpURL + "WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_GE_cal_event";
    events_date_url = glbDSWSCmpURL + "WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_GE_cal_eventdate";
    events_details_url = glbDSWSCmpURL + "WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_GE_cal_eventdet";
    deeplink_to_calendar = content.deeplink_to_calendar;
    deeplink_to_event = content.deeplink_to_event;
    deeplink_to_day = content.deeplink_to_day;
    timeOutMsg = content.calendar_timeout_message;
    failMsg = content.calendar_fail_message;
    calendarPersonID = "";
    timezoneOffset = " " + new Date().getTimezoneOffset();
    itemCount = "3";
    firsthit = "true";
    dateFormat = "DD MON YYYY";
    timeFormat = "HH24:MI";
    includeSubscribedEvents = "TRUE";
    includeCanceledEvents = "FALSE";
    daylightStartDate = "";
    daylightStartTime = "";
    daylightTimezoneOffset = "";
    startDateOffset = 300;
    endDateOffset = 300;
    previousmonthtrue = false;
    pagecounter = 1;
    upcomingeventdate = 1;
    currentmonth = '';
    currentyear = '';
    clickrefresh = '';
    prevMonth = '';
    prevYear = '';
    eventDetailsXML = '';
    previousmonthistrue = 'false';
    startDateMonth = '';
    endDateMonth = '';
    isGuestCalendar = 'false';
    EventBufferArray = [];
    partial = content.partial;
    partialHtml = null;
    dayNamesMin = ["S", "M", "T", "W", "T", "F", "S"];
    date = new Date();
    year = date.getFullYear();
    month = date.getMonth() + 1;
    currentyear = year;
    currentmonth = month;
    getEventsURL = get_events_url;
    eventsForDateURL = events_date_url
    // For Events on a particular
    // date
    eventDetailsURL = events_details_url;
    // For Event details,
    bubbleEventsForDateHTML = '';
    bubbleEventsForDateIsOpened = '';
    bubbleEventDetailsHTML = '';
    element = $("div#calendar-portlet.portlet");

    /* Calendar Export event to outlook static messages */
    exporteventtooutlookObj1 = JSON.parse(export_outlook_statictext).data[0].exporteventtooutlook;
    exporteventmodaltitleObj1 = JSON.parse(export_outlook_statictext).data[0].exporteventmodaltitle;
    exporteventmodalcontentObj1 = JSON.parse(export_outlook_statictext).data[0].exporteventmodalcontent;
    /* Calendar Export event to outlook static messages ends */
    if ($(window).width() < 768) {
        bubbleTemplates = {
            eventDetails: "<div class='bubble-event-details popover in'><div class='pointer'></div><a class='x-close close' href='#'>Close</a><div class='header'><h4> <a href=" + deeplink_to_calendar + " target='_blank'>View Calendar</a> </h4><a id='subscribe_cal'>" + exporteventtooutlookObj1 + "</a></div><div class='progress'><div class='indicator'></div></div><div class='content'><table><colgroup><col class='col-a' /><col class='col-b' /></colgroup><tbody></tbody></table></div></div>"
        };
    } else {
        bubbleTemplates = {
            eventDetails: "<div class='bubble-event-details'><div class='pointer'></div><a class='x-close close' href='#'>Close</a><div class='header'><h4> <a href=" + deeplink_to_calendar + " target='_blank'>View Calendar</a> </h4><a id='subscribe_cal'>" + exporteventtooutlookObj1 + "</a></div><div class='progress'><div class='indicator'></div></div><div class='content'><table><colgroup><col class='col-a' /><col class='col-b' /></colgroup><tbody></tbody></table></div></div>"
        };
    }

    /**
     * Binds click event listenr to links group togglers.
     *
     * @class
     * @constructs
     * @param selector
     *            The jquery selector
     * @param {Array}
     *            options the associative array of options
     */
    if ($("#calender-partial").length > 0) {
        //console.log("Inside If..");
        partialHtml = $("#calender-partial").html();
        $("#calender-partial").empty().remove();
        build(partialHtml);
    } else if (partial) {
        //console.log("Inside Else If..");
        $.get(partial, function (html) {
            var partialHtml = $("#calender-partial").html();
            partialHtml = html;
            //console.log("partialHtml value..");
            //console.log(partialHtml);
            build(html);
        });
    } else {
        //console.log("Inside Else..");
        build(html);
    }
    /**
     * This function is called after the ajax data request completes
     *
     * @param {String}
     *            html The html markup that was returned from the ajax
     *            request
     */
    function build(html) {
        //console.log("Inside build..");
        var today, calendar, ViewURL, datee11, date22, monthFirstDate, monthLastDate, minutesforlastday, monthFirstDateDTS, start_date_month, end_date_month, daylightTimezoneOffset, monthfirstdayforupcomg, monthLastDay, daylightChangeDate, daylightChangeHour, hourtozero, minutesadd, daylightStartDate, startDateMonth, endDateMonth, monthfirstdayforupcomg2, date1, daylightStartTime, eventsList, startDateTime, endDateTime, localOffset, eventtitle, event_tooltip, finalEventList, getFullViewForm, changeStart, changeEnd, starts, ends, eventtitlename, eventtitlenameVisible, eventlocationnname, eventlocationnnameVisible, event_desc, url_array, counter, securityIcon, new_url, protocol_type, url_found, indexOfWWW, substring_to_check, part_before_url, part_after_url, desc_part2, desc_part3, url_array_email, part1, mail_name, part2, domain_name, found_email, event_url, mail_to, eventDetailsUpcoming, cal_list, cal_tooltip, more_cal, datee, datee1, date, indexOfEnd, endDate, cal_start_date, cal_start_time, cal_start_hr, event_timee, cal_end_date, cal_end_time, cal_end_hr, end_timee;
        date = new Date();
        today = (date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate());
        // Format: 2010-2-1
        upcomingeventdate = today;
        element.html(html);
        getFullViewForm = element.find("#get-full-calendar-view-form");
        // Generate calendar widget with jQuery UI Calendar.
        calendar = element.find("#events-calendar .calendar").hide();
        ViewURL = deeplink_to_calendar;
        if ($.trim(ViewURL) !== '') {
            element.find('#view_calendar').attr('href', ViewURL);
        }
        getUpcomingList();
        calendar.datepicker({
            dayNamesMin: dayNamesMin,
            firstDay: 1,
            monthNames: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
            showWeek: true,
            weekHeader: 'Wk',
            showOtherMonths: true,
            onChangeMonthYear: function (year, month, inst) {
                // Calendar current month event date fixes.
                todayDate = "todayNotSet";
                $(" .bubble-event-details").hide();
                // CAL-1141
                $(" .bubble-date-events").hide();

                datee11 = new Date();
                $("#layer").show();
                date22 = new Date();

                if (parseInt(date22.getMonth() + 1) < parseInt(currentmonth)) {
                    previousmonthtrue = false;
                }
                currentmonth = month;
                currentyear = year;
                $("#upbuttonDiv").hide();
                $("#downbuttonDiv").hide();
                $("#upbuttonDiv2").show();
                $("#downbuttonDiv2").show();

                monthFirstDate = new Date(year, (month - 1), 1);

                monthLastDate = new Date(year, month, 0);
                minutesforlastday = (23 * 60) + 59;
                monthLastDate.setMinutes(minutesforlastday);
                monthFirstDateDTS = monthFirstDate.getTimezoneOffset();

                start_date_month = monthFirstDate;
                end_date_month = monthLastDate;

                daylightTimezoneOffset = end_date_month.getTimezoneOffset();

                monthfirstdayforupcomg = new Date(year, (month - 1), 1);

                monthfirstdayforupcomg = new Date(year, (month - 1), 1, 0, 0, 0);

                monthLastDay = end_date_month.getDate();
                if (start_date_month.getTimezoneOffset() !== end_date_month.getTimezoneOffset()) {
                    daylightChangeDate = getDaylightChangeDate(start_date_month, end_date_month);
                    daylightChangeHour = getDaylightChangeHour(daylightChangeDate, daylightChangeDate.getHours(), (daylightChangeDate.getHours() + 23));
                    if ((daylightChangeHour === 23) || (daylightChangeHour === '23')) {
                        hourtozero = 0;
                        daylightChangeDate.setHours(hourtozero);
                        minutesadd = (daylightChangeHour + 6) * 60;
                        daylightChangeDate.setMinutes(minutesadd);
                        daylightStartDate = (daylightChangeDate.getFullYear() + "-" + (daylightChangeDate.getMonth() + 1) + "-" + daylightChangeDate.getDate());

                        daylightStartTime = "00" + ":" + "00" + ":00";

                    } else {
                        daylightChangeDate.setHours(daylightChangeHour);
                        daylightStartDate = (daylightChangeDate.getFullYear() + "-" + (daylightChangeDate.getMonth() + 1) + "-" + daylightChangeDate.getDate());
                        daylightStartTime = ((daylightChangeDate.getHours() + 1) + ":" + daylightChangeDate.getMinutes() + ":00");

                    }
                } else {
                    daylightTimezoneOffset = "";
                    daylightStartDate = "";
                    daylightStartTime = "";
                }
                // eventextract call was here before
                // sathish
                startDateMonth = year + "-" + month + "-" + "1";
                endDateMonth = year + "-" + month + "-" + monthLastDay;

                if (firsthit === "true") {
                    monthfirstdayforupcomg2 = (monthfirstdayforupcomg.getFullYear() + "-" + (monthfirstdayforupcomg.getMonth() + 1) + "-" + monthfirstdayforupcomg.getDate());
                    date1 = new Date();

                    /*
                     * This is to check whether the date
                     * which the calendar is showing is
                     * present or less than the present
                     * month
                     */
                    if (((date1.getFullYear() === monthfirstdayforupcomg.getFullYear()) && ((monthfirstdayforupcomg.getMonth() + 1) <= (date1.getMonth() + 1))) || ((date1.getFullYear() > monthfirstdayforupcomg.getFullYear()))) {

                        /* check for present month */
                        if ((date1.getFullYear() === monthfirstdayforupcomg.getFullYear()) && ((monthfirstdayforupcomg.getMonth() + 1) === (date1.getMonth() + 1))) {
                            if (previousmonthtrue) {
                                previousmonthtrue = false;
                                $("#upbuttonDiv2").hide();
                                $("#downbuttonDiv2").hide();
                                $("#upbuttonDiv").show();
                                $("#downbuttonDiv").show();
                                // month extract view
                                // needs to be called
                                // here for current
                                // month when coming
                                // from back
                                getOnlyMonthExtractView(startDateMonth, endDateMonth);
                                return false;

                            } else {
                                monthfirstdayforupcomg2 = (date1.getFullYear() + "-" + (date1.getMonth() + 1) + "-" + date1.getDate());

                            }
                        } else {
                            previousmonthtrue = true;

                            $("#upbuttonDiv2").hide();
                            $("#downbuttonDiv2").hide();
                            $("#upbuttonDiv").show();
                            $("#downbuttonDiv").show();
                            // month extract view needs
                            // to be called here
                            getOnlyMonthExtractView(startDateMonth, endDateMonth);
                            return false;
                        }
                    }
                    /* In case next month */
                    else {
                        pagecounter = 1;
                    }

                    if ((date1.getFullYear() < monthfirstdayforupcomg.getFullYear())) {
                        monthfirstdayforupcomg2 = (monthfirstdayforupcomg.getFullYear() + "-" + (monthfirstdayforupcomg.getMonth() + 1) + "-" + monthfirstdayforupcomg.getDate());
                    }
                    if ((date1.getFullYear() === monthfirstdayforupcomg.getFullYear()) && ((monthfirstdayforupcomg.getMonth() + 1) === (date1.getMonth() + 1))) {
                        monthfirstdayforupcomg2 = (date1.getFullYear() + "-" + (date1.getMonth() + 1) + "-" + date1.getDate());
                        monthfirstdayforupcomg = date1;
                    }
                    upcomingeventdate = monthfirstdayforupcomg2;
                    $("#upcoming-events-list").find(".progress").show();
                    $("#upcoming-events-list").find("ul").remove();
                    $("#upbuttonDiv").hide();
                    $("#downbuttonDiv").hide();
                    $("#upbuttonDiv2").show();
                    $("#downbuttonDiv2").show();

                    getUpcomingEventsMonth(monthfirstdayforupcomg2, monthfirstdayforupcomg, 'next', function (events) {
                        $("#upcoming-events-list").find(".progress").show();
                        $("#upcoming-events-list").find("ul").remove();
                        if (events.event) {
                            localOffset = (-1 * timezoneOffset / 60);
                            eventsList = $("#upcoming-events-list").find(".progress").hide().end().append("<ul></ul>").find("ul");
                            $(events.event).each(function (i, event) {
                                startDateTime = new Date(event.start_date + " " + event.start_time + ":00");
                                endDateTime = new Date(event.end_date + " " + event.end_time + ":00");
                                if (event.is_timezone_independent === "NO") {
                                    startDateTime.setMinutes(startDateTime.getMinutes() + (localOffset * 60));
                                    endDateTime.setMinutes(endDateTime.getMinutes() + (localOffset * 60));
                                }
                                var date = startDateTime.toDateString().split(" ");
                                if (startDateTime.toDateString() !== endDateTime.toDateString())
                                    endDate = endDateTime.toDateString().split(" ");
                                eventtitle = (event.title);
                                event_tooltip = (event.title).replace(/'/g, "&#39;").replace(/"/g, '&#34;');

                                finalEventList = $("<li><span class='date'>" + date[1] + " " + date[2] + ((endDate) ? (" - " + endDate[1] + " " + endDate[2]) : "") + ":</span><br/> <div class=' div_event_name_cal' style=\"word-wrap:'break-word'\" ><a href='#' rel='" + event.id + "' id='" + event.id + "' title='" + event_tooltip + "'>" + "</a></div></li>").appendTo(eventsList);
                                getEventList(finalEventList, event.id, eventtitle);
                                finalEventList.find("a").click(function (e) {
                                    getFullViewForm = element.find("#get-full-calendar-view-form");
                                    getFullViewForm.find("#start_date").val("");
                                    // calendar event window positioning.
                                    bubbleDateEvent = "bubbleDateUpcommingEventSet";

                                    bubbleEventDetails($(this), $(this).attr("rel"), function (eventDetails) {
                                        if (eventDetails) {
                                            changeStart = $.datepicker.formatDate('dd M yy', new Date((eventDetails.start_date).replace(/-/g, '/')));
                                            changeEnd = $.datepicker.formatDate('dd M yy', new Date((eventDetails.end_date).replace(/-/g, '/')));
                                            cal_start_date = eventDetails.start;
                                            cal_start_time = cal_start_date.split('T')[1];
                                            cal_start_hr = cal_start_time.split(':');
                                            event_timee = cal_start_hr[0] + ":" + cal_start_hr[1];
                                            cal_end_date = eventDetails.end;
                                            cal_end_time = cal_end_date.split('T')[1];
                                            cal_end_hr = cal_end_time.split(':');
                                            end_timee = cal_end_hr[0] + ":" + cal_end_hr[1];
                                            startDateTime = new Date(changeStart + " " + event_timee + ":00");
                                            endDateTime = new Date(changeEnd + " " + end_timee + ":00");
                                            if (eventDetails.is_timezone_independent == "NO") {
                                                localOffset = (-1 * startDateTime.getTimezoneOffset() / 60);
                                                startDateTime.setMinutes(startDateTime.getMinutes() + (60 * localOffset));
                                                localOffset = (-1 * endDateTime.getTimezoneOffset() / 60);
                                                endDateTime.setMinutes(endDateTime.getMinutes() + (localOffset * 60));
                                            }
                                            starts = (startDateTime.toDateString().replace(/[a-zA-Z]{3,4}/, "") + ", " + startDateTime.toLocaleTimeString().replace(/(:[0-9]{1,2})( [a-zA-Z]{2}$)/, "$2"));
                                            starts = starts.substring(4, 7) + " " + starts.substring(0, 4) + " " + (starts.substring(7, starts.length));
                                            ends = (endDateTime.toDateString().replace(/[a-zA-Z]{3,4}/, "") + ", " + endDateTime.toLocaleTimeString().replace(/(:[0-9]{1,2})( [a-zA-Z]{2}$)/, "$2"));
                                            ends = ends.substring(4, 7) + " " + ends.substring(0, 4) + " " + (ends.substring(7, ends.length));
                                            switch (eventDetails.security_level) {

                                                case "Global":
                                                    securityIcon = "<img src='/m/eds/hrview/images/global.png' alt='Global' />";
                                                    break;
                                                case "Public":
                                                    securityIcon = "<img src='/m/eds/hrview/images/group.png' alt='Public' />";
                                                    break;
                                                default:
                                                    securityIcon = "<img src='/m/eds/hrview/images/locked.png' alt='Private' />";
                                            }

                                            eventtitlename = eventDetails.title;
                                            eventtitlenameVisible = eventDetails.title;
                                            if (eventtitlename.length > 30) {
                                                eventtitlenameVisible = eventtitlenameVisible.substring(0, 30) + " ...";
                                            }
                                            if (!window.ActiveXObject) {
                                                eventtitlename = breakword(eventtitlename);
                                            } else {
                                                eventtitlename = breakwordIE(eventtitlename, 20);
                                            }
                                            eventtitlename = (eventtitlename).replace(/'/g, "&#39;").replace(/"/g, '&#34;');
                                            eventlocationnname = eventDetails.locations.location;
                                            eventlocationnnameVisible = eventlocationnname;

                                            if (eventlocationnname) {
                                                if (eventlocationnname.length > 30) {
                                                    eventlocationnnameVisible = eventlocationnnameVisible.substring(0, 30) + " ...";
                                                }
                                                if (!window.ActiveXObject) {
                                                    eventlocationnname = breakword(eventDetails.locations.location);
                                                } else {
                                                    eventlocationnname = breakwordIE(eventlocationnname, 20);
                                                }
                                            }
                                            event_desc = eventDetails.details;
                                            event_desc = " " + event_desc + " ";
                                            url_array = [];
                                            counter = 0;

                                            if (event_desc.length > 300) {
                                                indexOfEnd = event_desc.indexOf(" ", 300);
                                                event_desc = event_desc.substring(0, 300) + " ...";
                                            }
                                            event_desc = 'NXNYNX~ ' + event_desc + ' NXNYNX~';
                                            while (true) {
                                                new_url = "";
                                                protocol_type = '';
                                                url_found = false;
                                                if (event_desc.indexOf('http://') > -1 || event_desc.indexOf('https://') > -1) {
                                                    if (event_desc.indexOf('http://') > -1) {
                                                        protocol_type = 'http://';
                                                    } else {
                                                        protocol_type = 'https://';
                                                    }
                                                    url_found = true;
                                                } else if (event_desc.indexOf("www.") > -1) {
                                                    indexOfWWW = event_desc.indexOf("www.");
                                                    substring_to_check = event_desc.substring(indexOfWWW - 1, indexOfWWW);
                                                    if ((substring_to_check !== "://") && ((substring_to_check === " ") || (substring_to_check === ",") || (substring_to_check === ":") || (substring_to_check === ";"))) {
                                                        protocol_type = "www";
                                                        url_found = true;
                                                    }
                                                }
                                                if (url_found) {
                                                    part_before_url = '';
                                                    part_after_url = '';
                                                    desc_part2 = event_desc.substring(event_desc.indexOf(protocol_type), event_desc.length);
                                                    desc_part3 = '';
                                                    if (desc_part2.indexOf(' ') > -1) {
                                                        desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.indexOf(' '));
                                                    } else if (desc_part2.indexOf(',') > -1) {
                                                        desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.indexOf(','));
                                                    } else if (desc_part2.indexOf('"') > -1) {
                                                        desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.indexOf('"'));
                                                    } else if (desc_part2.indexOf('\'') > -1) {
                                                        desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.indexOf('\''));
                                                    } else {
                                                        desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.length - 6);
                                                    }

                                                    url_array[counter] = desc_part3;
                                                    event_desc = event_desc.replace(desc_part3, "##^^##");
                                                    counter++;
                                                } else {
                                                    break;
                                                }
                                            }

                                            url_array_email = [];
                                            counter = 0;
                                            while (true) {
                                                if (event_desc.indexOf('@') > -1) {
                                                    part1 = event_desc.substring(0, event_desc.indexOf('@'));
                                                    mail_name = part1.substring(part1.lastIndexOf(' '), part1.length);
                                                    part2 = event_desc.substring(event_desc.indexOf('@'), event_desc.length);
                                                    domain_name = part2.substring(0, part2.indexOf(' '));
                                                    found_email = mail_name + domain_name;
                                                    url_array_email[counter] = found_email;
                                                    event_desc = event_desc.replace(found_email, "%*%*%*");
                                                    counter++;
                                                } else {
                                                    break;
                                                }
                                            }

                                            if (!window.ActiveXObject) {
                                                if (event_desc.indexOf('<a href') > -1) {
                                                    part2 = event_desc.substring(event_desc.indexOf('<a href='), event_desc.indexOf('a>') + 2);
                                                    event_desc = event_desc.replace(part2, "^^##^^");
                                                }
                                                event_desc = event_desc.replace(/\s+/g, ' ');
                                            }

                                            if (!window.ActiveXObject) {
                                                event_desc = breakword(event_desc);
                                                event_desc = event_desc.replace("^^##^^", part2);
                                            } else {
                                                event_desc = breakwordIE(event_desc);
                                                event_desc = event_desc.replace("^^##^^", part2);
                                            }

                                            for (var i = 0; i < url_array.length; i++) {
                                                event_url = url_array[i];
                                                if (event_url.indexOf("http://") > -1 || event_url.indexOf("https://") > -1) {
                                                    event_url = "<a href='" + event_url + "' target='_blank'><u>" + breakurl(event_url) + "</u></a>";
                                                } else {
                                                    event_url = "<a href='http://" + event_url + "' target='_blank'><u>" + breakurl(event_url) + "</u></a>";
                                                }
                                                event_desc = event_desc.replace("##^^##", event_url);
                                            }

                                            for (var i = 0; i < url_array_email.length; i++) {
                                                mail_to = url_array_email[i];
                                                mail_to = "<a href='mailto:" + mail_to + "'><u>" + breakurl(mail_to) + "</u></a>";
                                                event_desc = event_desc.replace("%*%*%*", mail_to);
                                            }

                                            event_desc = event_desc.replace('NXNYNX~', '');
                                            event_desc = event_desc.replace(' NXNYNX~', '');
                                            eventDetailsUpcoming = event_desc;
                                            cal_list = "";
                                            cal_tooltip = "";
                                            more_cal = false;
                                            $(eventDetailsXML).find("calendar").each(function (i) {
                                                cal_tooltip = cal_tooltip + $(this).text() + " , ";
                                                if (i < 3) {
                                                    cal_list = cal_list + $(this).text()
                                                    if (i <= 2) {
                                                        cal_list = cal_list + " , ";
                                                    }
                                                } else {
                                                    more_cal = true;
                                                }
                                            });

                                            if (more_cal) {
                                                cal_list = cal_list + "...";
                                            } else {
                                                cal_list = cal_list.substring(0, cal_list.lastIndexOf(","));
                                            }
                                            cal_tooltip = cal_tooltip.substring(0, cal_tooltip.lastIndexOf(","));
                                            if ($.trim(eventDetails.details) == "") {
                                                eventDetailsUpcoming = "No Details Available";
                                            }
                                            bubbleEventDetailsHTML.tbody.html("<tr class='calendar-name'><th>Name:</th><td title='" + eventDetails.calendars.calendar.content + "'>" + eventDetails.calendars.calendar.content + "</td></tr><tr class='event'><th><span>Event</span></th><td>" + securityIcon + "</td></tr><tr class='event-name'><th>Name:</th><td><div title=\"" + eventtitlename + "\" style=\"WORD-WRAP: break-word;width:174px;padding-top:6px;\" >" + eventtitlenameVisible + "</div></td></tr><tr class='type'><th>Type:</th><td><span>" + eventDetails.event_type.content + "</span></td></tr><tr class='location'><th><span>Location</span></th><td><div title=\"" + eventlocationnname + "\" style=\"WORD-WRAP: break-word;width:174px;\" >" + ((eventlocationnnameVisible) ? eventlocationnnameVisible : "") + "</div></td></tr><tr class='start-date'><th>Start Date:</th><td>" + starts + "</td></tr><tr class='end-date'><th>End Date:</th><td>" + ends + "</td></tr><tr class='details'><th>Details:</th><td><div  style=\"WORD-WRAP: break-word;width:174px;\" >" + eventDetailsUpcoming + "</div></td></tr>").find("tr.type span").css("background", eventDetails.event_type.color);
                                            bubbleEventDetailsHTML.progress.hide();
                                            bubbleEventDetailsHTML.content.show();
                                        }
                                    });
                                    return false;
                                });
                            });
                        } else if (!events.length && $('#upcoming-events-list ul > li').length == 0) {
                            eventsList = $("#upcoming-events-list").find(".progress").hide().end().append("<ul></ul>").find("ul");
                            eventsList.append("<li class='no-events'>There are no more upcoming events.</li>");
                        }

                        $("#upbuttonDiv2").hide();
                        $("#downbuttonDiv2").hide();
                        $("#downbuttonDiv").show();
                        $("#upbuttonDiv").show();
                    });
                    return false;
                }
                $("#upbuttonDiv2").hide();
                $("#downbuttonDiv2").hide();
                $("#upbuttonDiv").show();
                $("#downbuttonDiv").show();
                getUpcomingList();
            },
            beforeShowDay: function (date) {
                return [false, ""];
            }
        }).show();

        // Generate Upcoming Events list.

        datee = new Date();
        if ((currentyear == (datee.getFullYear())) && (currentmonth == (datee.getMonth() + 1))) {
            element.find(".refreshdate").unbind('click');
        } else {

            element.find(".refreshdate").click(function (e) {
                datee1 = new Date();
                if ((currentyear == (datee1.getFullYear())) && (currentmonth == (datee1.getMonth() + 1))) {
                    return false;
                }

                datee = new Date();
                previousmonthtrue = false;
                element.find(".upbutton").hide();
                element.find(".downbutton").hide();
                element.find(".upbutton2").show();
                element.find(".downbutton2").show();

                firsthit = "true";
                $("#upcoming-events-list").find(".progress").show();
                $("#upcoming-events-list").find("ul").remove();
                pagecounter = 1;

                if (partial) {
                    if (partialHtml == null) {

                        $.get(partial, function (html) {

                            clickrefresh = 'true';

                            build(html);
                        });
                    } else {
                        clickrefresh = 'true';
                        build(partialHtml);
                    }

                }

            })
        }
        ;

        element.find(".upbutton").click(function (e) {
            $("#downbuttonDiv").hide();
            $("#upbuttonDiv").hide();
            $("#downbuttonDiv2").show();
            $("#upbuttonDiv2").show();
            $("#upcoming-events-list").find(".progress").show();
            $("#upcoming-events-list").find("ul").remove();
            getUpcomingEventsNext5(upcomingeventdate, null, 'next', function (events) {
                if (events.event) {
                    localOffset = (-1 * timezoneOffset / 60);
                    eventsList = $("#upcoming-events-list").find(".progress").hide().end().append("<ul></ul>").find("ul");
                    $(events.event).each(function (i, event) {
                        startDateTime = new Date(event.start_date + " " + event.start_time + ":00");
                        endDateTime = new Date(event.end_date + " " + event.end_time + ":00");
                        if (event.is_timezone_independent == "NO") {
                            localOffset = (-1 * startDateTime.getTimezoneOffset() / 60);
                            startDateTime.setMinutes(startDateTime.getMinutes() + (localOffset * 60));
                            localOffset = (-1 * endDateTime.getTimezoneOffset() / 60);
                            endDateTime.setMinutes(endDateTime.getMinutes() + (localOffset * 60));
                        }
                        date = startDateTime.toDateString().split(" ");
                        if (startDateTime.toDateString() != endDateTime.toDateString())
                            var endDate = endDateTime.toDateString().split(" ");
                        eventtitle = event.title;
                        event_tooltip = (event.title).replace(/'/g, "&#39;").replace(/"/g, '&#34;');
                        finalEventList = $("<li><span class='date'>" + date[1] + " " + date[2] + ((endDate) ? (" - " + endDate[1] + " " + endDate[2]) : "") + ":</span><br/> <div class=' div_event_name_cal' style=\"word-wrap:'break-word'\" ><a href='#' rel='" + event.id + "' id='" + event.id + "' title='" + event_tooltip + "'>" + +"</a></div></li>").appendTo(eventsList)
                        getEventList(finalEventList, event.id, eventtitle);
                        finalEventList.find("a").click(function (e) {
                            getFullViewForm = element.find("#get-full-calendar-view-form");
                            getFullViewForm.find("#start_date").val("");
                            // calendar event window positioning.
                            bubbleDateEvent = "bubbleDateUpcommingEventSet";
                            bubbleEventDetails($(this), $(this).attr("rel"), function (eventDetails) {
                                if (eventDetails) {
                                    changeStart = $.datepicker.formatDate('dd M yy', new Date((eventDetails.start_date).replace(/-/g, '/')));
                                    changeEnd = $.datepicker.formatDate('dd M yy', new Date((eventDetails.end_date).replace(/-/g, '/')));
                                    cal_start_date = eventDetails.start;
                                    cal_start_time = cal_start_date.split('T')[1];
                                    cal_start_hr = cal_start_time.split(':');
                                    event_timee = cal_start_hr[0] + ":" + cal_start_hr[1];
                                    cal_end_date = eventDetails.end;
                                    cal_end_time = cal_end_date.split('T')[1];
                                    cal_end_hr = cal_end_time.split(':');
                                    end_timee = cal_end_hr[0] + ":" + cal_end_hr[1];
                                    startDateTime = new Date(changeStart + " " + event_timee + ":00");
                                    endDateTime = new Date(changeEnd + " " + end_timee + ":00");
                                    if (eventDetails.is_timezone_independent == "NO") {
                                        localOffset = (-1 * startDateTime.getTimezoneOffset() / 60);
                                        startDateTime.setMinutes(startDateTime.getMinutes() + (60 * localOffset));
                                        localOffset = (-1 * endDateTime.getTimezoneOffset() / 60);
                                        endDateTime.setMinutes(endDateTime.getMinutes() + (localOffset * 60));
                                    }
                                    starts = (startDateTime.toDateString().replace(/[a-zA-Z]{3,4}/, "") + ", " + startDateTime.toLocaleTimeString().replace(/(:[0-9]{1,2})( [a-zA-Z]{2}$)/, "$2"));
                                    ends = (endDateTime.toDateString().replace(/[a-zA-Z]{3,4}/, "") + ", " + endDateTime.toLocaleTimeString().replace(/(:[0-9]{1,2})( [a-zA-Z]{2}$)/, "$2"));
                                    starts = starts.substring(4, 7) + " " + starts.substring(0, 4) + " " + (starts.substring(7, starts.length));

                                    ends = ends.substring(4, 7) + " " + ends.substring(0, 4) + " " + (ends.substring(7, ends.length));

                                    switch (eventDetails.security_level) {
                                        case "Global":
                                            securityIcon = "<img src='/m/eds/hrview/images/global.png' alt='Global' />"
                                            break;
                                        case "Public":
                                            securityIcon = "<img src='/m/eds/hrview/images/group.png' alt='Public' />"
                                            break;
                                        default:
                                            securityIcon = "<img src=/m/eds/hrview/images/locked.png' alt='Private' />"
                                    }

                                    eventtitlename = (eventDetails.title).replace(/'/g, "&#39;").replace(/"/g, '&#34;');
                                    ;
                                    eventtitlenameVisible = eventtitlename;
                                    if (eventtitlename.length > 30) {
                                        eventtitlenameVisible = eventtitlenameVisible.substring(0, 30) + " ...";
                                    }
                                    if (!window.ActiveXObject) {
                                        eventtitlename = breakword(eventtitlename);
                                    } else {
                                        eventtitlename = breakwordIE(eventtitlename, 20);
                                    }
                                    eventtitlename = (eventtitlename).replace(/'/g, "&#39;").replace(/"/g, '&#34;');
                                    eventlocationnname = eventDetails.locations.location;
                                    eventlocationnnameVisible = eventlocationnname;

                                    if (eventlocationnname) {
                                        if (eventlocationnname.length > 30) {
                                            eventlocationnnameVisible = eventlocationnnameVisible.substring(0, 30) + " ...";
                                        }
                                        if (!window.ActiveXObject) {
                                            eventlocationnname = breakword(eventDetails.locations.location);
                                        } else {
                                            eventlocationnname = breakwordIE(eventlocationnname, 20);
                                        }
                                    }

                                    event_desc = eventDetails.details;
                                    event_desc = " " + event_desc + " ";
                                    url_array = [];
                                    counter = 0;

                                    if (event_desc.length > 300) {
                                        indexOfEnd = event_desc.indexOf(" ", 300);
                                        event_desc = event_desc.substring(0, 300) + " ...";
                                    }
                                    event_desc = 'NXNYNX~ ' + event_desc + ' NXNYNX~';
                                    while (true) {
                                        new_url = "";
                                        protocol_type = '';
                                        url_found = false;
                                        if (event_desc.indexOf('http://') > -1 || event_desc.indexOf('https://') > -1) {
                                            if (event_desc.indexOf('http://') > -1) {
                                                protocol_type = 'http://';
                                            } else {
                                                protocol_type = 'https://';
                                            }
                                            url_found = true;
                                        } else if (event_desc.indexOf("www.") > -1) {
                                            indexOfWWW = event_desc.indexOf("www.");
                                            substring_to_check = event_desc.substring(indexOfWWW - 1, indexOfWWW);
                                            if ((substring_to_check != "://") && ((substring_to_check == " ") || (substring_to_check == ",") || (substring_to_check == ":") || (substring_to_check == ";"))) {
                                                protocol_type = "www";
                                                url_found = true;
                                            }
                                        }
                                        if (url_found) {
                                            part_before_url = '';
                                            part_after_url = '';
                                            desc_part2 = event_desc.substring(event_desc.indexOf(protocol_type), event_desc.length);
                                            desc_part3 = '';
                                            if (desc_part2.indexOf(' ') > -1) {
                                                desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.indexOf(' '));
                                            } else if (desc_part2.indexOf(',') > -1) {
                                                desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.indexOf(','));
                                            } else if (desc_part2.indexOf('"') > -1) {
                                                desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.indexOf('"'));
                                            } else if (desc_part2.indexOf('\'') > -1) {
                                                desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.indexOf('\''));
                                            } else {
                                                desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.length - 6);
                                            }

                                            url_array[counter] = desc_part3;
                                            event_desc = event_desc.replace(desc_part3, "##^^##");
                                            counter++;
                                        } else {
                                            break;
                                        }
                                    }

                                    url_array_email = [];
                                    counter = 0;
                                    while (true) {
                                        if (event_desc.indexOf('@') > -1) {
                                            part1 = event_desc.substring(0, event_desc.indexOf('@'));
                                            mail_name = part1.substring(part1.lastIndexOf(' '), part1.length);
                                            part2 = event_desc.substring(event_desc.indexOf('@'), event_desc.length);
                                            domain_name = part2.substring(0, part2.indexOf(' '));
                                            found_email = mail_name + domain_name;
                                            url_array_email[counter] = found_email;
                                            event_desc = event_desc.replace(found_email, "%*%*%*");
                                            counter++;
                                        } else {
                                            break;
                                        }
                                    }

                                    if (!window.ActiveXObject) {
                                        if (event_desc.indexOf('<a href') > -1) {
                                            part2 = event_desc.substring(event_desc.indexOf('<a href='), event_desc.indexOf('a>') + 2);
                                            event_desc = event_desc.replace(part2, "^^##^^");
                                        }
                                        event_desc = event_desc.replace(/\s+/g, ' ');
                                    }

                                    if (!window.ActiveXObject) {
                                        event_desc = breakword(event_desc);
                                        event_desc = event_desc.replace("^^##^^", part2);
                                    } else {
                                        event_desc = breakwordIE(event_desc);
                                        event_desc = event_desc.replace("^^##^^", part2);
                                    }

                                    for (var i = 0; i < url_array.length; i++) {
                                        event_url = url_array[i];
                                        if (event_url.indexOf("http://") > -1 || event_url.indexOf("https://") > -1) {
                                            event_url = "<a href='" + event_url + "' target='_blank'><u>" + breakurl(event_url) + "</u></a>";
                                        } else {
                                            event_url = "<a href='http://" + event_url + "' target='_blank'><u>" + breakurl(event_url) + "</u></a>";
                                        }
                                        event_desc = event_desc.replace("##^^##", event_url);
                                    }

                                    for (var i = 0; i < url_array_email.length; i++) {
                                        mail_to = url_array_email[i];
                                        mail_to = "<a href='mailto:" + mail_to + "'><u>" + breakurl(mail_to) + "</u></a>";
                                        event_desc = event_desc.replace("%*%*%*", mail_to);
                                    }

                                    event_desc = event_desc.replace('NXNYNX~', '');
                                    event_desc = event_desc.replace(' NXNYNX~', '');
                                    eventDetailsUpcoming = event_desc;

                                    cal_list = "";
                                    cal_tooltip = "";
                                    more_cal = false;
                                    $(eventDetailsXML).find("calendar").each(function (i) {
                                        cal_tooltip = cal_tooltip + $(this).text() + " , ";
                                        if (i < 3) {
                                            cal_list = cal_list + $(this).text()
                                            if (i <= 2) {
                                                cal_list = cal_list + " , ";
                                            }
                                        } else {
                                            more_cal = true;
                                        }
                                    });

                                    if (more_cal) {
                                        cal_list = cal_list + "...";
                                    } else {
                                        cal_list = cal_list.substring(0, cal_list.lastIndexOf(","));
                                    }
                                    cal_tooltip = cal_tooltip.substring(0, cal_tooltip.lastIndexOf(","));
                                    if ($.trim(eventDetails.details) == "") {
                                        eventDetailsUpcoming = "No Details Available";
                                    }

                                    bubbleEventDetailsHTML.tbody.html("<tr class='calendar-name'><th>Name:</th><td title='" + eventDetails.calendars.calendar.content + "'>" + eventDetails.calendars.calendar.content + "</td></tr><tr class='event'><th><span>Event</span></th><td>" + securityIcon + "</td></tr><tr class='event-name'><th>Name:</th><td><div title=\"" + eventtitlename + "\" style=\"WORD-WRAP: break-word;width:174px;padding-top:6px;\" >" + eventtitlenameVisible + "</div></td></tr><tr class='type'><th>Type:</th><td><span>" + eventDetails.event_type.content + "</span></td></tr><tr class='location'><th><span>Location</span></th><td><div  title=\"" + eventlocationnname + "\"   style=\"WORD-WRAP: break-word;width:174px;\" >" + ((eventlocationnnameVisible) ? eventlocationnnameVisible : "") + "</div></td></tr><tr class='start-date'><th>Start Date:</th><td>" + starts + "</td></tr><tr class='end-date'><th>End Date:</th><td>" + ends + "</td></tr><tr class='details'><th>Details:</th><td> <div  style=\"WORD-WRAP: break-word;width:174px;\" >" + eventDetailsUpcoming + "</div></td></tr>").find("tr.type span").css("background", eventDetails.event_type.color);
                                    bubbleEventDetailsHTML.progress.hide();
                                    bubbleEventDetailsHTML.content.show();
                                }
                            });
                            return false;
                        });
                    });

                } else if (!events.length && $('#upcoming-events-list ul > li').length == 0) {
                    eventsList = $("#upcoming-events-list").find(".progress").hide().end().append("<ul></ul>").find("ul");
                    eventsList.append("<li class='no-events'>There are no upcoming events.</li>");
                }
                $("#downbuttonDiv2").hide();
                $("#upbuttonDiv2").hide();
                $("#downbuttonDiv").show();
                $("#upbuttonDiv").show();
            });
        });
        // this is click on today text
        element.find(".refreshdate").click(function (e) {
            $("#upcoming-events-list").find(".progress").show();
            $("#upcoming-events-list").find("ul").remove();
            if (partial) {
                if (partialHtml == null) {
                    $.get(partial, function (html) {
                        build(html);
                    });
                } else {
                    build(partialHtml);
                }

            }
        });
        element.find(".downbutton").click(function (e) {

            if (pagecounter == 1) {
                return false;
            }
            $("#upcoming-events-list").find(".progress").show();
            $("#upcoming-events-list").find("ul").remove();
            $("#downbuttonDiv").hide();
            $("#upbuttonDiv").hide();
            $("#downbuttonDiv2").show();
            $("#upbuttonDiv2").show();

            getUpcomingEventsNext5(upcomingeventdate, null, 'prev', function (events) {
                if (events.event) {
                    localOffset = (-1 * timezoneOffset / 60);
                    eventsList = $("#upcoming-events-list").find(".progress").hide().end().append("<ul></ul>").find("ul");
                    $(events.event).each(function (i, event) {
                        startDateTime = new Date(event.start_date + " " + event.start_time + ":00");
                        endDateTime = new Date(event.end_date + " " + event.end_time + ":00");
                        if (event.is_timezone_independent == "NO") {
                            startDateTime.setMinutes(startDateTime.getMinutes() + (localOffset * 60));
                            endDateTime.setMinutes(endDateTime.getMinutes() + (localOffset * 60));
                        }
                        date = startDateTime.toDateString().split(" ");
                        if (startDateTime.toDateString() != endDateTime.toDateString())
                            var endDate = endDateTime.toDateString().split(" ");
                        eventtitle = event.title;
                        event_tooltip = (event.title).replace(/'/g, "&#39;").replace(/"/g, '&#34;');
                        finalEventList = $("<li><span class='date'>" + date[1] + " " + date[2] + ((endDate) ? (" - " + endDate[1] + " " + endDate[2]) : "") + ":</span><br/> <div class='div_event_name_cal' style=\"word-wrap:'break-word'\" ><a href='#' rel='" + event.id + "' id='" + event.id + "' title='" + event_tooltip + "'>" + +"</a></div></li>").appendTo(eventsList)
                        getEventList(finalEventList, event.id, eventtitle);
                        finalEventList.find("a").click(function (e) {
                            getFullViewForm = element.find("#get-full-calendar-view-form");
                            getFullViewForm.find("#start_date").val("");
                            // calendar event window positioning.
                            bubbleDateEvent = "bubbleDateUpcommingEventSet";
                            bubbleEventDetails($(this), $(this).attr("rel"), function (eventDetails) {
                                if (eventDetails) {
                                    changeStart = $.datepicker.formatDate('dd M yy', new Date((eventDetails.start_date).replace(/-/g, '/')));
                                    changeEnd = $.datepicker.formatDate('dd M yy', new Date((eventDetails.end_date).replace(/-/g, '/')));
                                    cal_start_date = eventDetails.start;
                                    cal_start_time = cal_start_date.split('T')[1];
                                    cal_start_hr = cal_start_time.split(':');
                                    event_timee = cal_start_hr[0] + ":" + cal_start_hr[1];
                                    cal_end_date = eventDetails.end;
                                    cal_end_time = cal_end_date.split('T')[1];
                                    cal_end_hr = cal_end_time.split(':');
                                    end_timee = cal_end_hr[0] + ":" + cal_end_hr[1];
                                    startDateTime = new Date(changeStart + " " + event_timee + ":00");
                                    endDateTime = new Date(changeEnd + " " + end_timee + ":00");
                                    if (eventDetails.is_timezone_independent == "NO") {
                                        localOffset = (-1 * startDateTime.getTimezoneOffset() / 60);
                                        startDateTime.setMinutes(startDateTime.getMinutes() + (60 * localOffset));
                                        localOffset = (-1 * endDateTime.getTimezoneOffset() / 60);
                                        endDateTime.setMinutes(endDateTime.getMinutes() + (localOffset * 60));
                                    }
                                    starts = (startDateTime.toDateString().replace(/[a-zA-Z]{3,4}/, "") + ", " + startDateTime.toLocaleTimeString().replace(/(:[0-9]{1,2})( [a-zA-Z]{2}$)/, "$2"));
                                    ends = (endDateTime.toDateString().replace(/[a-zA-Z]{3,4}/, "") + ", " + endDateTime.toLocaleTimeString().replace(/(:[0-9]{1,2})( [a-zA-Z]{2}$)/, "$2"));

                                    starts = starts.substring(4, 7) + " " + starts.substring(0, 4) + " " + (starts.substring(7, starts.length));

                                    ends = ends.substring(4, 7) + " " + ends.substring(0, 4) + " " + (ends.substring(7, ends.length));
                                    switch (eventDetails.security_level) {
                                        case "Global":
                                            securityIcon = "<img src='/m/eds/hrview/images/global.png' alt='Global' />"
                                            break;
                                        case "Public":
                                            securityIcon = "<img src='/m/eds/hrview/images/group.png' alt='Public' />"
                                            break;
                                        default:
                                            securityIcon = "<img src='/m/eds/hrview/images/locked.png' alt='Private' />"
                                    }

                                    eventtitlename = (eventDetails.title).replace(/'/g, "&#39;").replace(/"/g, '&#34;');
                                    ;
                                    eventtitlenameVisible = eventtitlename;
                                    if (eventtitlename.length > 30) {
                                        eventtitlenameVisible = eventtitlenameVisible.substring(0, 30) + " ...";
                                    }
                                    if (!window.ActiveXObject) {
                                        eventtitlename = breakword(eventtitlename);
                                    } else {
                                        eventtitlename = breakwordIE(eventtitlename, 20);
                                    }
                                    eventtitlename = (eventtitlename).replace(/'/g, "&#39;").replace(/"/g, '&#34;');
                                    eventlocationnname = eventDetails.locations.location;
                                    eventlocationnnameVisible = eventlocationnname;

                                    if (eventlocationnname) {
                                        if (eventlocationnname.length > 30) {
                                            eventlocationnnameVisible = eventlocationnnameVisible.substring(0, 30) + " ...";
                                        }
                                        if (!window.ActiveXObject) {
                                            eventlocationnname = breakword(eventDetails.locations.location);
                                        } else {
                                            eventlocationnname = breakwordIE(eventlocationnname, 20);
                                        }
                                    }

                                    event_desc = eventDetails.details;
                                    event_desc = " " + event_desc + " ";
                                    url_array = [];
                                    counter = 0;

                                    if (event_desc.length > 300) {
                                        var indexOfEnd = event_desc.indexOf(" ", 300);
                                        event_desc = event_desc.substring(0, 300) + " ...";
                                    }
                                    event_desc = 'NXNYNX~ ' + event_desc + ' NXNYNX~';
                                    while (true) {
                                        new_url = "";
                                        protocol_type = '';
                                        url_found = false;
                                        if (event_desc.indexOf('http://') > -1 || event_desc.indexOf('https://') > -1) {
                                            if (event_desc.indexOf('http://') > -1) {
                                                protocol_type = 'http://';
                                            } else {
                                                protocol_type = 'https://';
                                            }
                                            url_found = true;
                                        } else if (event_desc.indexOf("www.") > -1) {
                                            var indexOfWWW = event_desc.indexOf("www.");
                                            var substring_to_check = event_desc.substring(indexOfWWW - 1, indexOfWWW);
                                            if ((substring_to_check != "://") && ((substring_to_check == " ") || (substring_to_check == ",") || (substring_to_check == ":") || (substring_to_check == ";"))) {
                                                protocol_type = "www";
                                                url_found = true;
                                            }
                                        }
                                        if (url_found) {
                                            part_before_url = '';
                                            part_after_url = '';
                                            desc_part2 = event_desc.substring(event_desc.indexOf(protocol_type), event_desc.length);
                                            desc_part3 = '';
                                            if (desc_part2.indexOf(' ') > -1) {
                                                desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.indexOf(' '));
                                            } else if (desc_part2.indexOf(',') > -1) {
                                                desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.indexOf(','));
                                            } else if (desc_part2.indexOf('"') > -1) {
                                                desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.indexOf('"'));
                                            } else if (desc_part2.indexOf('\'') > -1) {
                                                desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.indexOf('\''));
                                            } else {
                                                desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.length - 6);
                                            }

                                            url_array[counter] = desc_part3;
                                            event_desc = event_desc.replace(desc_part3, "##^^##");
                                            counter++;
                                        } else {
                                            break;
                                        }
                                    }

                                    url_array_email = [];
                                    counter = 0;
                                    while (true) {
                                        if (event_desc.indexOf('@') > -1) {
                                            part1 = event_desc.substring(0, event_desc.indexOf('@'));
                                            mail_name = part1.substring(part1.lastIndexOf(' '), part1.length);
                                            part2 = event_desc.substring(event_desc.indexOf('@'), event_desc.length);
                                            domain_name = part2.substring(0, part2.indexOf(' '));
                                            found_email = mail_name + domain_name;
                                            url_array_email[counter] = found_email;
                                            event_desc = event_desc.replace(found_email, "%*%*%*");
                                            counter++;
                                        } else {
                                            break;
                                        }
                                    }

                                    if (!window.ActiveXObject) {
                                        if (event_desc.indexOf('<a href') > -1) {
                                            part2 = event_desc.substring(event_desc.indexOf('<a href='), event_desc.indexOf('a>') + 2);
                                            event_desc = event_desc.replace(part2, "^^##^^");
                                        }
                                        event_desc = event_desc.replace(/\s+/g, ' ');
                                    }

                                    if (!window.ActiveXObject) {
                                        event_desc = breakword(event_desc);
                                        event_desc = event_desc.replace("^^##^^", part2);
                                    } else {
                                        event_desc = breakwordIE(event_desc);
                                        event_desc = event_desc.replace("^^##^^", part2);
                                    }

                                    for (var i = 0; i < url_array.length; i++) {
                                        var event_url = url_array[i];
                                        if (event_url.indexOf("http://") > -1 || event_url.indexOf("https://") > -1) {
                                            event_url = "<a href='" + event_url + "' target='_blank'><u>" + breakurl(event_url) + "</u></a>";
                                        } else {
                                            event_url = "<a href='http://" + event_url + "' target='_blank'><u>" + breakurl(event_url) + "</u></a>";
                                        }
                                        event_desc = event_desc.replace("##^^##", event_url);
                                    }

                                    for (var i = 0; i < url_array_email.length; i++) {
                                        mail_to = url_array_email[i];
                                        mail_to = "<a href='mailto:" + mail_to + "'><u>" + breakurl(mail_to) + "</u></a>";
                                        event_desc = event_desc.replace("%*%*%*", mail_to);
                                    }

                                    event_desc = event_desc.replace('NXNYNX~', '');
                                    event_desc = event_desc.replace(' NXNYNX~', '');
                                    eventDetailsUpcoming = event_desc;

                                    /*
                                     * if($.browser.msie) {
                                     * var
                                     * xmlDoc =
                                     * new
                                     * ActiveXObject("Microsoft.XMLDOM");
                                     * xmlDoc.loadXML(self.options.eventDetailsXML);
                                     * self.options.eventDetailsXML =
                                     * xmlDoc;
                                     * }else{
                                     * var
                                     * parser=new
                                     * DOMParser();
                                     * self.options.eventDetailsXML=parser.parseFromString(self.options.eventDetailsXML,"text/xml"); }
                                     */
                                    cal_list = "";
                                    cal_tooltip = "";
                                    more_cal = false;
                                    $(eventDetailsXML).find("calendar").each(function (i) {
                                        cal_tooltip = cal_tooltip + $(this).text() + " , ";
                                        if (i < 3) {
                                            cal_list = cal_list + $(this).text()
                                            if (i <= 2) {
                                                cal_list = cal_list + " , ";
                                            }
                                        } else {
                                            more_cal = true;
                                        }
                                    });
                                    if (more_cal) {
                                        cal_list = cal_list + "...";
                                    } else {
                                        cal_list = cal_list.substring(0, cal_list.lastIndexOf(","));
                                    }
                                    cal_tooltip = cal_tooltip.substring(0, cal_tooltip.lastIndexOf(","));
                                    if ($.trim(eventDetails.details) == "") {
                                        eventDetailsUpcoming = "No Details Available";
                                    }

                                    bubbleEventDetailsHTML.tbody.html("<tr class='calendar-name'><th>Name:</th><td title='" + eventDetails.calendars.calendar.content + "'>" + eventDetails.calendars.calendar.content + "</td></tr><tr class='event'><th><span>Event</span></th><td>" + securityIcon + "</td></tr><tr class='event-name'><th>Name:</th><td><div title=\"" + eventtitlename + "\" style=\"WORD-WRAP: break-word;width:174px;padding-top:6px;\" >" + eventtitlenameVisible + "</div></td></tr><tr class='type'><th>Type:</th><td><span>" + eventDetails.event_type.content + "</span></td></tr><tr class='location'><th><span>Location</span></th><td><div title=\"" + eventlocationnname + "\"  style=\"WORD-WRAP: break-word;width:174px;\" >" + ((eventlocationnnameVisible) ? eventlocationnnameVisible : "") + "</div></td></tr><tr class='start-date'><th>Start Date:</th><td>" + starts + "</td></tr><tr class='end-date'><th>End Date:</th><td>" + ends + "</td></tr><tr class='details'><th>Details:</th><td><div  style=\"WORD-WRAP: break-word;width:174px;\" >" + eventDetailsUpcoming + "</div></td></tr>").find("tr.type span").css("background", eventDetails.event_type.color);
                                    bubbleEventDetailsHTML.progress.hide();
                                    bubbleEventDetailsHTML.content.show();
                                }
                            });
                            return false;
                        });
                    });

                } else if (!events.length && $('#upcoming-events-list ul > li').length == 0) {
                    eventsList = $("#upcoming-events-list").find(".progress").hide().end().append("<ul></ul>").find("ul");
                    eventsList.append("<li class='no-events'>There are no upcoming events.</li>");
                }
            });

            $("#upbuttonDiv2").hide();
            $("#downbuttonDiv2").hide();
            $("#upbuttonDiv").show();
            $("#downbuttonDiv").show();

        });

        $("#upbuttonDiv2").hide();
        $("#downbuttonDiv2").hide();
        $("#upbuttonDiv").show();
        $("#downbuttonDiv").show();

        // Generate Upcoming Events list.
    }

    function getUpcomingList() {
        var today, localOffset, eventsList, startDateTime, endDateTime, date, eventtitle, event_tooltip, finalEventList, getFullViewForm, changeStart, changeEnd, startDateTime, endDateTime, starts, ends, securityIcon, eventtitlename, eventtitlenameVisible, eventlocationnname, eventlocationnnameVisible, event_desc, url_array, counter, indexOfEnd, new_url, protocol_type, url_found, indexOfWWW, substring_to_check, part_before_url, part_after_url, desc_part2, desc_part3, url_array_email, part1, mail_name, part2, domain_name, found_email, part2, event_url, mail_to, eventDetailsUpcoming, cal_list, cal_tooltip, more_cal, cal_start_date, cal_start_time, cal_start_hr, event_timee, cal_end_date, cal_end_time, cal_end_hr, end_timee;
        date = new Date();
        today = (date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate());
        getUpcomingEvents(today, null, function (events) {

            if (events.event) {
                localOffset = (-1 * timezoneOffset / 60);
                $("#upcoming-events-list").find("ul").remove();
                eventsList = $("#upcoming-events-list").find(".progress").hide().end().append("<ul></ul>").find("ul");
                $(events.event).each(function (i, event) {
                    startDateTime = new Date(event.start_date + " " + event.start_time + ":00");
                    endDateTime = new Date(event.end_date + " " + event.end_time + ":00");
                    if (event.is_timezone_independent == "NO") {
                        startDateTime.setMinutes(startDateTime.getMinutes() + (localOffset * 60));
                        endDateTime.setMinutes(endDateTime.getMinutes() + (localOffset * 60));
                    }
                    date = startDateTime.toDateString().split(" ");
                    if (startDateTime.toDateString() != endDateTime.toDateString())
                        var endDate = endDateTime.toDateString().split(" ");
                    eventtitle = (event.title);
                    event_tooltip = (event.title).replace(/'/g, "&#39;").replace(/"/g, '&#34;');
                    finalEventList = $("<li><span class='date'>" + date[1] + " " + date[2] + ((endDate) ? (" - " + endDate[1] + " " + endDate[2]) : "") + ":</span><br/> <div class=' div_event_name_cal' style=\"word-wrap:'break-word'\" ><a href='#' rel='" + event.id + "' id='" + event.id + "' title='" + event_tooltip + "'>" + +"</a></div></li>").appendTo(eventsList)
                    getEventList(finalEventList, event.id, eventtitle);
                    finalEventList.find("a").click(function (e) {
                        getFullViewForm = element.find("#get-full-calendar-view-form");
                        getFullViewForm.find("#start_date").val("");
                        // calendar event window positioning.
                        bubbleDateEvent = "bubbleDateUpcommingEventSet";

                        bubbleEventDetails($(this), $(this).attr("rel"), function (eventDetails) {
                            if (eventDetails) {
                                changeStart = $.datepicker.formatDate('dd M yy', new Date((eventDetails.start_date).replace(/-/g, '/')));
                                changeEnd = $.datepicker.formatDate('dd M yy', new Date((eventDetails.end_date).replace(/-/g, '/')));
                                cal_start_date = eventDetails.start;
                                cal_start_time = cal_start_date.split('T')[1];
                                cal_start_hr = cal_start_time.split(':');
                                event_timee = cal_start_hr[0] + ":" + cal_start_hr[1];
                                cal_end_date = eventDetails.end;
                                cal_end_time = cal_end_date.split('T')[1];
                                cal_end_hr = cal_end_time.split(':');
                                end_timee = cal_end_hr[0] + ":" + cal_end_hr[1];
                                changeStart = $.datepicker.formatDate('dd M yy', new Date((eventDetails.start_date).replace(/-/g, '/')));
                                changeEnd = $.datepicker.formatDate('dd M yy', new Date((eventDetails.end_date).replace(/-/g, '/')));
                                startDateTime = new Date(changeStart + " " + event_timee + ":00");
                                endDateTime = new Date(changeEnd + " " + end_timee + ":00");
                                if (eventDetails.is_timezone_independent == "NO") {
                                    localOffset = (-1 * startDateTime.getTimezoneOffset() / 60);
                                    startDateTime.setMinutes(startDateTime.getMinutes() + (60 * localOffset));
                                    localOffset = (-1 * endDateTime.getTimezoneOffset() / 60);
                                    endDateTime.setMinutes(endDateTime.getMinutes() + (localOffset * 60));
                                }

                                starts = (startDateTime.toDateString().replace(/[a-zA-Z]{3,4}/, "") + ", " + startDateTime.toLocaleTimeString().replace(/(:[0-9]{1,2})( [a-zA-Z]{2}$)/, "$2"));
                                ends = (endDateTime.toDateString().replace(/[a-zA-Z]{3,4}/, "") + ", " + endDateTime.toLocaleTimeString().replace(/(:[0-9]{1,2})( [a-zA-Z]{2}$)/, "$2"));
                                starts = starts.substring(4, 7) + " " + starts.substring(0, 4) + " " + (starts.substring(7, starts.length));
                                ends = ends.substring(4, 7) + " " + ends.substring(0, 4) + " " + (ends.substring(7, ends.length));

                                switch (eventDetails.security_level) {
                                    case "Global":
                                        securityIcon = "<img src='/m/eds/hrview/images/global.png' alt='Global' />"
                                        break;
                                    case "Public":
                                        securityIcon = "<img src='/m/eds/hrview/images/group.png' alt='Public' />"
                                        break;
                                    default:
                                        securityIcon = "<img src='/m/eds/hrview/images/locked.png' alt='Private' />"
                                }

                                eventtitlename = eventDetails.title;
                                eventtitlenameVisible = eventtitlename;
                                if (eventtitlename.length > 30) {
                                    eventtitlenameVisible = eventtitlenameVisible.substring(0, 30) + " ...";
                                }
                                if (!window.ActiveXObject) {
                                    eventtitlename = breakword(eventtitlename);
                                } else {
                                    eventtitlename = breakwordIE(eventtitlename, 20);
                                }

                                eventtitlename = (eventtitlename).replace(/'/g, "&#39;").replace(/"/g, '&#34;');
                                eventlocationnname = eventDetails.locations.location;
                                eventlocationnnameVisible = eventlocationnname;

                                if (eventlocationnname) {
                                    if (eventlocationnname.length > 30) {
                                        eventlocationnnameVisible = eventlocationnnameVisible.substring(0, 30) + " ...";

                                    }
                                    if (!window.ActiveXObject) {
                                        eventlocationnname = breakword(eventDetails.locations.location);
                                    } else {
                                        eventlocationnname = breakwordIE(eventlocationnname, 20);
                                    }
                                }
                                event_desc = eventDetails.details;
                                event_desc = " " + event_desc + " ";
                                url_array = [];
                                counter = 0;

                                if (event_desc.length > 300) {
                                    indexOfEnd = event_desc.indexOf(" ", 300);
                                    event_desc = event_desc.substring(0, 300) + " ...";
                                }
                                event_desc = 'NXNYNX~ ' + event_desc + ' NXNYNX~';
                                while (true) {
                                    new_url = "";
                                    protocol_type = '';
                                    url_found = false;
                                    if (event_desc.indexOf('http://') > -1 || event_desc.indexOf('https://') > -1) {
                                        if (event_desc.indexOf('http://') > -1) {
                                            protocol_type = 'http://';
                                        } else {
                                            protocol_type = 'https://';
                                        }
                                        url_found = true;
                                    } else if (event_desc.indexOf("www.") > -1) {
                                        indexOfWWW = event_desc.indexOf("www.");
                                        substring_to_check = event_desc.substring(indexOfWWW - 1, indexOfWWW);
                                        if ((substring_to_check != "://") && ((substring_to_check == " ") || (substring_to_check == ",") || (substring_to_check == ":") || (substring_to_check == ";"))) {
                                            protocol_type = "www";
                                            url_found = true;
                                        }
                                    }
                                    if (url_found) {
                                        part_before_url = '';
                                        part_after_url = '';
                                        desc_part2 = event_desc.substring(event_desc.indexOf(protocol_type), event_desc.length);
                                        desc_part3 = '';
                                        if (desc_part2.indexOf(' ') > -1) {
                                            desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.indexOf(' '));
                                        } else if (desc_part2.indexOf(',') > -1) {
                                            desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.indexOf(','));
                                        } else if (desc_part2.indexOf('"') > -1) {
                                            desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.indexOf('"'));
                                        } else if (desc_part2.indexOf('\'') > -1) {
                                            desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.indexOf('\''));
                                        } else {
                                            desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.length - 6);
                                        }
                                        url_array[counter] = desc_part3;
                                        event_desc = event_desc.replace(desc_part3, "##^^##");
                                        counter++;
                                    } else {
                                        break;
                                    }
                                }
                                url_array_email = [];
                                counter = 0;
                                while (true) {
                                    if (event_desc.indexOf('@') > -1) {
                                        part1 = event_desc.substring(0, event_desc.indexOf('@'));
                                        mail_name = part1.substring(part1.lastIndexOf(' '), part1.length);
                                        part2 = event_desc.substring(event_desc.indexOf('@'), event_desc.length);
                                        domain_name = part2.substring(0, part2.indexOf(' '));
                                        found_email = mail_name + domain_name;
                                        url_array_email[counter] = found_email;
                                        event_desc = event_desc.replace(found_email, "%*%*%*");
                                        counter++;
                                    } else {
                                        break;
                                    }
                                }
                                if (!window.ActiveXObject) {
                                    if (event_desc.indexOf('<a href') > -1) {
                                        part2 = event_desc.substring(event_desc.indexOf('<a href='), event_desc.indexOf('a>') + 2);
                                        event_desc = event_desc.replace(part2, "^^##^^");
                                    }
                                    event_desc = event_desc.replace(/\s+/g, ' ');
                                }
                                if (!window.ActiveXObject) {
                                    event_desc = breakword(event_desc);
                                    event_desc = event_desc.replace("^^##^^", part2);
                                } else {
                                    event_desc = breakwordIE(event_desc);
                                    event_desc = event_desc.replace("^^##^^", part2);
                                }
                                for (var i = 0; i < url_array.length; i++) {
                                    event_url = url_array[i];
                                    if (event_url.indexOf("http://") > -1 || event_url.indexOf("https://") > -1) {
                                        event_url = "<a href='" + event_url + "' target='_blank'><u>" + breakurl(event_url) + "</u></a>";
                                    } else {
                                        event_url = "<a href='http://" + event_url + "' target='_blank'><u>" + breakurl(event_url) + "</u></a>";
                                    }
                                    event_desc = event_desc.replace("##^^##", event_url);
                                }
                                for (var i = 0; i < url_array_email.length; i++) {
                                    mail_to = url_array_email[i];
                                    mail_to = "<a href='mailto:" + mail_to + "'><u>" + breakurl(mail_to) + "</u></a>";
                                    event_desc = event_desc.replace("%*%*%*", mail_to);
                                }
                                event_desc = event_desc.replace('NXNYNX~', '');
                                event_desc = event_desc.replace(' NXNYNX~', '');
                                eventDetailsUpcoming = event_desc;

                                //this is added as multiple calendar names are not appearing from json
                                /* if($.browser.msie) {
                                 var xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
                                 xmlDoc.loadXML(self.options.eventDetailsXML);
                                 self.options.eventDetailsXML = xmlDoc;
                                 }else{
                                 var parser=new DOMParser();
                                 self.options.eventDetailsXML=parser.parseFromString(self.options.eventDetailsXML,"text/xml");
                                 }      */
                                cal_list = "";
                                cal_tooltip = "";
                                more_cal = false;
                                $(eventDetailsXML).find("calendar").each(function (i) {
                                    cal_tooltip = cal_tooltip + $(this).text() + " , ";
                                    if (i < 3) {
                                        cal_list = cal_list + $(this).text()
                                        if (i <= 2) {
                                            cal_list = cal_list + " , ";
                                        }
                                    } else {
                                        more_cal = true;
                                    }
                                });

                                if (more_cal) {
                                    cal_list = cal_list + "...";
                                } else {
                                    cal_list = cal_list.substring(0, cal_list.lastIndexOf(","));
                                }
                                cal_tooltip = cal_tooltip.substring(0, cal_tooltip.lastIndexOf(","));
                                if ($.trim(eventDetails.details) == "") {
                                    eventDetailsUpcoming = "No Details Available";
                                }

                                bubbleEventDetailsHTML.tbody.html("<tr class='calendar-name'><th>Name:</th><td title='" + eventDetails.calendars.calendar.content + "'>" + eventDetails.calendars.calendar.content + "</td></tr><tr class='event'><th><span>Event</span></th><td>" + securityIcon + "</td></tr><tr class='event-name'><th>Name:</th><td><div  title=\"" + eventtitlename + "\" style=\"WORD-WRAP: break-word;width:174px;\" >" + eventtitlenameVisible + "</div></td></tr><tr class='type'><th>Type:</th><td><span>" + eventDetails.event_type.content + "</span></td></tr><tr class='location'><th><span>Location</span></th><td><div title=\"" + eventlocationnname + "\"  style=\"WORD-WRAP: break-word;width:174px;padding-top:6px;\" >" + ((eventlocationnnameVisible) ? eventlocationnnameVisible : "") + "</div></td></tr><tr class='start-date'><th>Start Date:</th><td>" + starts + "</td></tr><tr class='end-date'><th>End Date:</th><td>" + ends + "</td></tr><tr class='details'><th>Details:</th><td><div  style=\"WORD-WRAP: break-word;width:174px;\" >" + eventDetailsUpcoming + "</div></td></tr>").find("tr.type span").css("background", eventDetails.event_type.color);
                                bubbleEventDetailsHTML.progress.hide();
                                bubbleEventDetailsHTML.content.show();
                            }
                        });
                        return false;
                    });
                });
            } else if (!events.length && $('#upcoming-events-list ul > li').length == 0) {
                eventsList = $("#upcoming-events-list").find(".progress").hide().end().append("<ul></ul>").find("ul");
                eventsList.append("<li class='no-events'>There are no upcoming events.</li>");
            }

            $("#upbuttonDiv2").hide();
            $("#downbuttonDiv2").hide();
            $("#upbuttonDiv").show();
                $("#downbuttonDiv").show();
        });
        //getUpcomingevenst call back ends here

    }

    /**
     * Gets list of events in the month in JSON.
     * and pass it to the extractevents for only month extract view
     */
    function getOnlyMonthExtractView(startDateMonth, endDateMonth) {
        var date, startDateTimezoneOffset, startDateChange, startTimeChange, json;
        date = new Date();
        startDateTimezoneOffset = new Date(startDateMonth.replace(/-/gi, "/")).getTimezoneOffset();
        startDateChange = ((new Date()).getUTCFullYear() + "-" + ((new Date()).getUTCMonth() + 1) + "-" + (new Date()).getUTCDate());
        startTimeChange = ((new Date()).getUTCHours() + ":" + (new Date()).getUTCMinutes() + ":" + (new Date()).getUTCSeconds());
        json = {
            "start_date": startDateChange,
            "start_time": startTimeChange,
            "timezone_offset": timezoneOffset,
            "page_no": "1",
            "item_count": itemCount,
            "date_format_display": dateFormat,
            "time_format_display": timeFormat,
            "include_subscribed_events": includeSubscribedEvents,
            "start_date_month": startDateMonth,
            "end_date_month": endDateMonth,
            "include_canceled": includeCanceledEvents,
            "daylight_start_date": "",
            "daylight_start_time": "",
            "timezone_offset_daylight": "",
            "is_guest_user": "TRUE",
            "pagelocation": page_location
        };
        $.ajax({
            url: getEventsURL,
            data: json,
            contentType: "application/json",
            dataType: "json",
            traditional: true,
            success: function (data, instID) {
                EventExtract(data);
            },
            error: function (error) {
                try {
                    //console.log(error);
                } catch (error) {
                }
            }
        });
    }

    function callBackSuccess(jsonOutput, instID, funcName, callback) {
        var events, eventDetails;
        if (funcName == 'getUpcomingEventsMonth') {

            EventBufferArray[pagecounter] = jsonOutput;
            events = jsonOutput.events;
            if ($.isFunction(callback))
                callback(events, instID);
            EventExtract(jsonOutput);
            return events;
        } else if (funcName == 'getUpcomingEventsNext5') {

            EventBufferArray[pagecounter] = jsonOutput;
            events = jsonOutput.events;
            if ($.isFunction(callback))
                callback(events, instID);
            return events;
        } else if (funcName == 'getEventsForDate') {
            events = jsonOutput.events;
            if (!events)
                try {
                    //console.log(jsonOutput);
                } catch (error) {
                }
            ;
            if ($.isFunction(callback))
                callback(events);
            return events;
        } else if (funcName == 'getEventDetails') {

            eventDetails = JSON.parse(jsonOutput).event;
            if (!eventDetails)
                try {
                    //console.log(jsonOutput);
                } catch (error) {
                }
            ;
            if ($.isFunction(callback))
                callback(eventDetails);
            return eventDetails;
        } else if (funcName == 'getUpcomingEvents') {

            EventBufferArray[pagecounter] = jsonOutput;
            events = jsonOutput.events;
            if ($.isFunction(callback))
                callback(events, instID);
            EventExtract(jsonOutput);
            return events;
        }

    }

    function callBackError(error) {
        try {
            //console.log(error);
        } catch (error) {
        }

    }

    /**
     * Gets list of events in the month in JSON.
     * Does cross-domain call across IGE services for XML and transform xml to json on client side.
     * @param {String} startDate The date from wish list of events should start with (e.g. 2010-2-1).
     * @param {String} endDate The date from wish list of events should end in (e.g. 2010-2-30).
     * @param {Function} callback The callback function with events passed.
     */

    function getEventsExtract(json, callback) {
        var calendarMonth, date22, kkl, get_more1, get_more, personID, months;
        calendarMonth = startDateMonth.split("-");
        date22 = new Date();
        kkl = parseInt(calendarMonth[1]);
        element.find(".refreshdate").remove();
        element.find(".refreshdate1").remove();
        if ((calendarMonth[0] != date22.getFullYear()) || (((kkl) < (parseInt(date22.getMonth()) + 1))) || ((kkl) > (parseInt(date22.getMonth()) + 1))) {
            get_more1 = document.createElement('div');
            get_more1.className = 'refreshdate';
            get_more = document.createElement('a');
            get_more.setDisabled = true;
            get_more1.appendChild(get_more);
            get_more.alt = "Today";
            get_more.title = "Today";
            get_more.appendChild(document.createTextNode("Today"));
            $('.ui-datepicker-title').append(get_more1);
            element.find(".refreshdate").click(function (e) {

                if (parseInt(date22.getMonth() + 1) < parseInt(currentmonth)) {
                    previousmonthtrue = false;
                }
                if (((calendarMonth[0] < date22.getFullYear())) || ((calendarMonth[0] == date22.getFullYear()) && ((kkl) < (parseInt(date22.getMonth()) + 1)))) {
                    previousmonthistrue = "true";
                }

                if (!(((kkl) == (parseInt(date22.getMonth()) + 1)) && (calendarMonth[0] == date22.getFullYear()))) {
                    firsthit = "true";
                    pagecounter = 1;
                    if (partial) {
                        if (partialHtml == null) {
                            $.get(partial, function (html) {
                                clickrefresh = 'true';
                                build(html);
                            });
                        } else {
                            clickrefresh = 'true';
                            build(partialHtml);
                        }

                    }
                }

            });
        } else {
            get_more = document.createElement('span');
            get_more.className = 'refreshdate1';
            get_more.appendChild(document.createTextNode("Today"));
            $('.ui-datepicker-title').append(get_more);
            element.find(".ui-datepicker-title").click(function (e) {
                return false;
            })
            element.find(".refreshdate1").click(function (e) {
                return false;
            })
            element.find(".refreshdate").unbind('click');
        }

        personID = json.person_id;
        months = json.months.month;
        if ($.isFunction(callback))
            callback(months, personID);

    }

    /**
     * Gets list of upcoming events in JSON.
     * Does cross-domain call across IGE services for XML and transform xml to json on client side.
     * @param {String} startDate The date from wish list of events should start with (e.g. 2010-2-1).
     * @param {String} startTime The time in which events should start from (e.g. 17:46:8).
     * @param {Function} callback The callback function with events passed.
     */

    function getUpcomingEvents(startDate, startTime, callback) {
        var year, month, startDateMonth, monthLastDate, endDateMonth, startDatex, json;
        // Calendar current month event date fixes.
        todayDate = "todaySet";
        year = date.getFullYear();
        month = date.getMonth() + 1;
        startDateMonth = year + "-" + month + "-" + "1";
        monthLastDate = new Date(year, month, 0);
        endDateMonth = year + "-" + month + "-" + monthLastDate.getDate();
        startDatex = (date.getUTCFullYear() + "-" + (date.getUTCMonth() + 1) + "-" + date.getUTCDate());
        if (!startTime)
            var startTime = (date.getUTCHours() + ":" + date.getUTCMinutes() + ":" + date.getUTCSeconds());
        json = {
            "start_date": startDatex,
            "start_time": startTime,
            "timezone_offset": timezoneOffset,
            "page_no": "1",
            "item_count": itemCount,
            "date_format_display": dateFormat,
            "time_format_display": timeFormat,
            "include_subscribed_events": includeSubscribedEvents,
            "start_date_month": startDateMonth,
            "end_date_month": endDateMonth,
            "include_canceled": includeCanceledEvents,
            "daylight_start_date": "",
            "daylight_start_time": "",
            "timezone_offset_daylight": "",
            "is_guest_user": "TRUE",
            "pagelocation": page_location
        };
        $.ajax({
            url: getEventsURL,
            data: json,
            contentType: "application/json",
            dataType: "json",
            traditional: true,
            success: function (data, instID) {
                callBackSuccess(data, instID, 'getUpcomingEvents', callback);
            },
            error: function (error) {
                callBackError(error);
            }
        });
    }

    function getUpcomingEventsMonth(startDate, startTime, prevornext, callback) {
        var year, dtstr, month, monthLastDate, end_date_month, monthLastDay, endDateMonth, startDateMonth, startDAte1, json;
        year = date.getFullYear();
        dtstr = startDate.split('-');
        month = dtstr[1];
        // Calendar year changes for event date displaying incorrect.
        year = dtstr[0];
        monthLastDate = new Date(year, month, 0);
        end_date_month = monthLastDate;
        monthLastDay = end_date_month.getDate();
        endDateMonth = year + "-" + month + "-" + monthLastDay;
        startDateMonth = year + "-" + month + "-" + "1";
        startTime1 = (startTime.getUTCHours() + ":" + startTime.getUTCMinutes() + ":" + startTime.getUTCSeconds());
        startDAte1 = (startTime.getUTCFullYear() + "-" + (startTime.getUTCMonth() + 1) + "-" + startTime.getUTCDate());

        json = {
            "start_date": startDAte1,
            "start_time": startTime1,
            "timezone_offset": timezoneOffset,
            "page_no": "1",
            "item_count": itemCount,
            "date_format_display": dateFormat,
            "time_format_display": timeFormat,
            "include_subscribed_events": includeSubscribedEvents,
            "start_date_month": startDate,
            "end_date_month": endDateMonth,
            "include_canceled": includeCanceledEvents,
            "daylight_start_date": daylightStartDate,
            "daylight_start_time": daylightStartTime,
            "timezone_offset_daylight": daylightTimezoneOffset,
            "is_guest_user": "TRUE",
            "pagelocation": page_location
        };

        $.ajax({
            url: getEventsURL,
            data: json,
            contentType: "application/json",
            dataType: "json",
            traditional: true,
            success: function (data, instID) {
                callBackSuccess(data, instID, 'getUpcomingEventsMonth', callback);
            },
            error: function (error) {
                callBackError(error);
            }
        });
    }

    function getUpcomingEventsNext5(startDate, startTime, prevornext, callback) {
        var events, json;
        if (!startTime)
            var startTime = ((date.getHours()) + ":" + date.getMinutes() + ":00");
        if (prevornext == 'prev' && pagecounter > 1) {
            pagecounter = pagecounter - 1;
            events = EventBufferArray[pagecounter].events;
            if ($.isFunction(callback))
                callback(events);
            return events;
        }
        if (prevornext == 'next') {
            pagecounter = pagecounter + 1;
        }
        pagecounterVal = (pagecounter).toString();
        json = {
            "start_date": startDate,
            "start_time": startTime,
            "timezone_offset": timezoneOffset,
            "page_no": pagecounterVal,
            "item_count": itemCount,
            "date_format_display": dateFormat,
            "time_format_display": timeFormat,
            "include_subscribed_events": includeSubscribedEvents,
            "start_date_month": startDateMonth,
            "end_date_month": endDateMonth,
            "include_canceled": includeCanceledEvents,
            "daylight_start_date": daylightStartDate,
            "daylight_start_time": daylightStartTime,
            "timezone_offset_daylight": daylightTimezoneOffset,
            "is_guest_user": "TRUE",
            "pagelocation": page_location
        };

        $.ajax({
            url: getEventsURL,
            data: json,
            contentType: "application/json",
            dataType: "json",
            traditional: true,
            success: function (data, instID) {
                callBackSuccess(data, instID, 'getUpcomingEventsNext5', callback);
            },
            error: function (error) {
                callBackError(error);
            }
        });

    }

    /**
     * Get events from a day from a range of time in JSON.
     * Does cross-domain call across IGE services for XML and transform xml to json on client side.
     * @param {String} startDate The date from wish list of events should start with (e.g. 2010-2-1).
     * @param {String} endDate The date in which events should start from (e.g. 2010-2-1).
     * @param {Function} callback The callback function with events passed.
     */
    function getEventsForDate(startDate, endDate, callback) {
        var startDateObj, endDateObj, changedStartDate, changedEndDate, timeDifference, nextEndDateObj, startTime, endTime, startDateTimezoneOffset, json;
        startDateObj = new Date(startDate.replace(/-/gi, "/"));
        endDateObj = new Date(endDate.replace(/-/gi, "/"));
        changedStartDate = startDateObj.getUTCFullYear() + "-" + (parseInt(startDateObj.getUTCMonth()) + 1) + "-" + startDateObj.getUTCDate();
        changedEndDate = endDateObj.getUTCFullYear() + "-" + (parseInt(endDateObj.getUTCMonth()) + 1) + "-" + endDateObj.getUTCDate();
        if (startDateObj.getTimezoneOffset() != endDateObj.getTimezoneOffset()) {
            timeDifference = startDateObj.getTimezoneOffset() - endDateObj.getTimezoneOffset();
            endDateObj.setMinutes(endDateObj.getMinutes() - timeDifference);
        }
        var nextEndDateObj = new Date(endDate.replace(/-/gi, "/") + " " + endDateObj.getHours() + 23 + ":" + endDateObj.getMinutes() + 59);
        startTime = (startDateObj.getUTCHours() + ":" + startDateObj.getUTCMinutes() + ":" + startDateObj.getUTCSeconds());
        endTime = (nextEndDateObj.getUTCHours() + ":" + nextEndDateObj.getUTCMinutes() + ":" + nextEndDateObj.getUTCSeconds());
        startDateTimezoneOffset = startDateObj.getTimezoneOffset();
        json = {
            "start_date": changedStartDate,
            "start_time": startTime,
            "end_date": changedEndDate,
            "end_time": endTime,
            "timezone_offset": timezoneOffset,
            "date_format_display": dateFormat,
            "time_format_display": timeFormat,
            "include_subscribed_events": includeSubscribedEvents,
            "start_date_offset": (startDateObj.getTimezoneOffset()).toString(),
            "end_date_offset": (nextEndDateObj.getTimezoneOffset()).toString(),
            "is_guest_user": "TRUE",
            "pagelocation": page_location
        };

        $.ajax({
            url: eventsForDateURL,
            data: json,
            contentType: "application/json",
            dataType: "json",
            traditional: true,
            success: function (data, instID) {
                callBackSuccess(data, instID, 'getEventsForDate', callback);
            },
            error: function (error) {
                callBackError(error);
            }
        });
    }

    /**
     * Gets event details in JSON.
     * Does cross-domain call across IGE services for XML and transform xml to json on client side.
     * @param {String} startDate The date from wish list of events should start with (e.g. 76EAAE1E1382179EE040310355056076).
     * @param {Function} callback The callback function with events passed.
     */
    /* Get calendar Id for export event to outlook local storage */
    var LOCAL_STORAGE_KEY_USERCALENDARID = username + '_usercalendarID';
    var LOCAL_STORAGE_KEY_ISRECURRENTEVENT = username + '_isrecurrentevent';
    var LOCAL_STORAGE_KEY_RECURRENTEVENTID = username + '_recurrenteventID';
    /* Get calendar Id for export event to outlook local storage */
    function getEventDetails(eventID, callback) {
        var timeFormat = "HH24:MI AM";
        $.ajax({
            url: eventDetailsURL,
            data: "calendar_id=" + eventID,
            contentType: "application/json",
            success: function (data, instID) {
                /* Get calendar Id for export event to outlook */
                var jsoneventdetails = data;
                var usercalendarID = JSON.parse(jsoneventdetails).event.calendars.calendar.id;
                var is_recurrent_event = JSON.parse(jsoneventdetails).event.is_recurrent;
                var recurrent_eventID = JSON.parse(jsoneventdetails).event.recurrent_id;
                localStorage.setItem(LOCAL_STORAGE_KEY_USERCALENDARID, usercalendarID);
                localStorage.setItem(LOCAL_STORAGE_KEY_ISRECURRENTEVENT, is_recurrent_event);
                localStorage.setItem(LOCAL_STORAGE_KEY_RECURRENTEVENTID, recurrent_eventID);
                /* Get calendar Id for export event to outlook */
                callBackSuccess(data, instID, 'getEventDetails', callback);
            },
            error: function (error) {
                callBackError(error);
            }
        });
    }

    /**
     * Get exact daylight change date (ported from legacy, needs to be refactored).
     * @param {Object} startDate date object
     * @param {Object} lastDate date object
     * @returns {Object} (2010-2-1)
     * @private
     */

    function getDaylightChangeDate(startDate, lastDate) {
        var midDate, startDateOffset, lastDateOffset, midDateOffset, finalDate;
        midDate = new Date(startDate.getFullYear(), startDate.getMonth(), Math.round((lastDate.getDate() + startDate.getDate()) / 2));
        startDateOffset = startDate.getTimezoneOffset();
        lastDateOffset = lastDate.getTimezoneOffset();
        midDateOffset = midDate.getTimezoneOffset();
        finalDate = new Date();
        if (startDateOffset == midDateOffset) {

            if ((lastDate.getDate() - midDate.getDate()) > 1) {
                // check for DST @ Rio De Generio
                if ((midDate).getDate() == (startDate).getDate()) {
                    finalDate = startDate;
                    return finalDate;
                }
                finalDate = getDaylightChangeDate(midDate, lastDate);

            } else if (lastDateOffset != midDateOffset) {

                finalDate = midDate;
            }
        } else {

            if ((midDate.getDate() - startDate.getDate()) > 1) {

                finalDate = getDaylightChangeDate(startDate, midDate);
            } else if (startDateOffset != midDateOffset) {

                finalDate = startDate;
            }
        }
        return finalDate;

    }

    /**
     * Get daylight change hour (ported from legacy, needs to be refactored).
     * @param {Object} timezoneChangedDate date object
     * @param {String} startHour date object
     * @param {String} endHour date object
     * @returns {string}
     * @private
     */
    function getDaylightChangeHour(timezoneChangedDate, startHour, endHour) {
        var tempTimeZoneChangedDate, tempTimeZoneChangedDateEnd, midHour, startHourOffset, endHourOffset, midHourOffset, finalHour;
        tempTimeZoneChangedDate = timezoneChangedDate;
        tempTimeZoneChangedDateEnd = timezoneChangedDate;
        midHour = Math.ceil((startHour + endHour) / 2);
        tempTimeZoneChangedDate.setHours(startHour);
        startHourOffset = tempTimeZoneChangedDate.getTimezoneOffset();
        tempTimeZoneChangedDate.setHours(endHour);
        endHourOffset = tempTimeZoneChangedDate.getTimezoneOffset();
        tempTimeZoneChangedDate.setHours(midHour);
        midHourOffset = tempTimeZoneChangedDate.getTimezoneOffset();
        finalHour = "";
        if (startHourOffset == midHourOffset) {
            if ((endHour - midHour) > 1) {
                finalHour = getDaylightChangeHour(tempTimeZoneChangedDate, midHour, endHour);
            } else {
                tempTimeZoneChangedDateEnd.setHours(endHour);
                tempTimeZoneChangedDate.setHours(midHour);
                if (tempTimeZoneChangedDate.getHours() != midHour)
                    finalHour = midHour;
                else if (tempTimeZoneChangedDateEnd.getHours() != endHour)
                    finalHour = endHour;
                else if (endHourOffset != midHourOffset)
                    finalHour = endHour;
            }
        } else {
            if ((midHour - startHour) > 1) {
                finalHour = getDaylightChangeHour(timezoneChangedDate, startHour, midHour);
            } else {
                tempTimeZoneChangedDate.setHours(startHour);
                tempTimeZoneChangedDateEnd.setHours(midHour);
                if (tempTimeZoneChangedDate.getHours() != startHour)
                    finalHour = startHour;
                else if (tempTimeZoneChangedDateEnd.getHours() != midHour)
                    finalHour = midHour;
                else if (startHourOffset != midHourOffset)
                    finalHour = midHour;
            }
        }
        return finalHour;
    }

    function breakword(divText) {
        var divtext, totalwords, wordsarray, letterarray, finaltext, lastvalue;
        divtext = divText;
        totalwords = 0;
        wordsarray = new Array();
        letterarray = new Array();
        finaltext = new Array();
        if (divtext.indexOf('&nbsp;') > 0) {
            divtext = divtext.replace(/&nbsp;/g, ' ');
        }
        a = divtext.replace(/\s/g, ' ');
        wordsarray = a.split(' ');
        for (z = 0; z < wordsarray.length; z++) {
            if (wordsarray[z].length > 0)
                totalwords++;
        }
        for (x = 0; x < totalwords; x++) {
            if (wordsarray[x].length >= 20) {
                letterarray = wordsarray[x].split('');
                var newTxt = letterarray.join('&#8203;');
                finaltext[x] = newTxt;
            } else {
                finaltext[x] = wordsarray[x];
            }
        }
        lastvalue = finaltext.join(' ');
        return lastvalue;
    }

    function breakwordIE(divText, lengthIEParm) {
        var lengthIE, divtext, totalwords, wordsarray, letterarray, finaltext, lastvalue;
        lengthIE = 20;
        if (lengthIEParm != null) {
            lengthIE = lengthIEParm;
        }
        divtext = divText;
        totalwords = 0;
        wordsarray = new Array();
        letterarray = new Array();
        finaltext = new Array();

        if (divtext.indexOf('&nbsp;') > 0) {
            divtext = divtext.replace(/&nbsp;/g, ' ');
        }
        a = divtext.replace(/\s/g, ' ');
        wordsarray = a.split(' ');
        for (z = 0; z < wordsarray.length; z++) {
            if (wordsarray[z].length > 0)
                totalwords++;
        }
        for (x = 0; x < totalwords; x++) {
            if (wordsarray[x].length >= lengthIE) {
                var iteratornum = Math.ceil(wordsarray[x].length / lengthIE);
                var newTxt = '';
                for (i = 0; i < iteratornum; i++) {
                    if (i < iteratornum - 1) {
                        newTxt = newTxt + wordsarray[x].substring(i * lengthIE, (i + 1) * lengthIE) + ' '
                    } else {
                        newTxt = newTxt + wordsarray[x].substring(i * lengthIE, wordsarray[x].length)
                    }
                }
                finaltext[x] = newTxt;
            } else {
                finaltext[x] = wordsarray[x];
            }
        }
        lastvalue = finaltext.join(' ');
        return lastvalue;

    }

    /**
     * @returns {string}
     * @private
     */
    function getDTSDateTime(year, month) {
        // Set the starting date
        var monthFirstDate, monthLastDate, changeDay, changeMinute, hoursOffset, dstDate, tmpDate, tmpOffset, minutes;
        monthFirstDate = new Date(year, (month - 1), 0);
        monthLastDate = new Date(year, month, 0);
        changeDay = 0;
        changeMinute = -1;
        hoursOffset = (-1 * monthLastDate.getTimezoneOffset() / 60);
        dstDate;
        for (day = 0; day < 50; day++) {
            tmpDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
            tmpOffset = -1 * tmpDate.getTimezoneOffset() / 60;
            // Check if the timezone changed from one day to the next
            if (tmpOffset != hoursOffset) {
                minutes = 0;
                changeDay = day;
                // Back-up one day and grap the offset
                tmpDate = new Date(Date.UTC(year, month, day - 1, 0, 0, 0, 0));
                tmpOffset = -1 * tmpDate.getTimezoneOffset() / 60;
                // Count the minutes until a timezone chnage occurs
                while (changeMinute == -1) {
                    tmpDate = new Date(Date.UTC(year, month, day - 1, 0, minutes, 0, 0));
                    tmpOffset = -1 * tmpDate.getTimezoneOffset() / 60;
                    // Determine the exact minute a timezone change
                    // occurs
                    if (tmpOffset != baseOffset) {
                        // Back-up a minute to get the date/time just
                        // before a timezone change occurs
                        tmpOffset = new Date(Date.UTC(year, month, day - 1, 0, minutes - 1, 0, 0));
                        changeMinute = minutes;
                        break;
                    } else
                        minutes++;
                }
                // Add a month (for display) since JavaScript counts
                // months from 0 to 11
                dstDate = tmpOffset.getMonth() + 1;
                // Pad the month as needed
                if (dstDate < 10)
                    dstDate = "0" + dstDate;
                // Add the day and year
                dstDate += '/' + tmpOffset.getDate() + '/' + year + ' ';
                // Capture the time stamp
                tmpDate = new Date(Date.UTC(year, month, day - 1, 0, minutes - 1, 0, 0));
                dstDate += tmpDate.toTimeString().split(' ')[0];
                return dstDate;
            }
        }
    }
    /**
     * Toggles list of events for the date.
     * Calls getEventsForDate method.
     * @param {Object} el The element that trigger it.
     * @param {String} startDate The date from wish list of events should start with (e.g. 2010-2-1).
     * @param {String} endDate The date in which events should start from (e.g. 2010-2-1).
     * @param {Function} callback The callback function with events passed.
     */
    function bubbleEventsForDate(el, startDate, endDate, callback) {

        $(" .bubble-event-details").hide();
        //CAL-1141
        var offset, date, event_for_day, date, isMousedOut, eventday, bubbleTemplates, self;
        self = this;
        offset = el.offset();
        date = startDate.split("-");
        if (date[1] < 10) {
            date[1] = "0" + date[1];
        }
        event_for_day = date[1] + "-" + date[2] + "-" + date[0];
        date = new Date(date[0], (date[1] - 1), date[2]);
        isMousedOut = true;
        eventday = deeplink_to_day + event_for_day;
        if ($(window).width() < 768) {
            bubbleTemplates = {
                eventsForDate: "<div class='bubble-date-events popover in'><div class='pointer'></div><a class='x-close close' href='#'>Close</a><div class='header'><h4> <a class='date' href=" + eventday + " target='_blank'>{bubbleEventDate}</a> <a href='" + deeplink_to_calendar + "' target='_blank'>View Calendar</a> </h4></div><div class='progress'><div class='indicator'></div></div><div class='content'><table><colgroup><col class='col-a' /><col class='col-b' /><col class='col-c' /><col class='col-d' /></colgroup><thead><tr><th></th><th>Events Name</th><th>Time</th><th>Location</th></tr></thead><tbody></tbody></table></div></div>",
            };
        }
        else {
            bubbleTemplates = {
                eventsForDate: "<div class='bubble-date-events'><div class='pointer'></div><a class='x-close close' href='#'>Close</a><div class='header'><h4> <a class='date' href=" + eventday + " target='_blank'>{bubbleEventDate}</a> <a href='" + deeplink_to_calendar + "' target='_blank'>View Calendar</a> </h4></div><div class='progress'><div class='indicator'></div></div><div class='content'><table><colgroup><col class='col-a' /><col class='col-b' /><col class='col-c' /><col class='col-d' /></colgroup><thead><tr><th></th><th>Events Name</th><th>Time</th><th>Location</th></tr></thead><tbody></tbody></table></div></div>",
            };
        }
        if (!bubbleEventsForDateHTML) {
            bubbleEventsForDateHTML = $(bubbleTemplates.eventsForDate).appendTo(document.body).hide();
            bubbleEventsForDateHTML.content = bubbleEventsForDateHTML.find(".content").hide();
            bubbleEventsForDateHTML.tbody = bubbleEventsForDateHTML.find("tbody");
            bubbleEventsForDateHTML.progress = bubbleEventsForDateHTML.find(".progress");
            bubbleEventsForDateHTML.bind("bubbleEventsForDateClose", function (e) {
                if (isMousedOut && bubbleEventsForDateIsOpened) {
                    $(this).fadeOut("fast");
                    bubbleEventsForDateIsOpened = false;
                }
            }).mouseleave(function (e) {
                isMousedOut = true;
            }).mouseenter(function (e) {
                isMousedOut = false;
            });
            bubbleEventsForDateHTML.find("a.close").click(function (e) {
                bubbleEventsForDateHTML.fadeOut("fast");
                bubbleEventsForDateIsOpened = false;
                return false;
            });

        }
        bubbleEventsForDateHTML.find("h4 a").unbind();
        if (bubbleEventsForDateIsOpened) {
            bubbleEventsForDateHTML.queue(function () {
                $(this).fadeOut("fast");
                $(this).dequeue();
            });
        }
        bubbleEventsForDateHTML.queue(function () {
            bubbleEventsForDateHTML.tbody.html("");
            bubbleEventsForDateHTML.content.hide();
            bubbleEventsForDateHTML.progress.show();
            $(this).find("h4 a.date").attr("href", eventday);
            $(this).find("h4 a.date").text(date.toLocaleDateString());
            $(this).find("h4 a").click(function (e) {
            });
            $(this).css({
                top: (offset.top + 23) + "px",
                left: (offset.left - 360) + "px"
            });
            $(this).fadeIn("slow");
            bubbleEventsForDateIsOpened = true;
            getEventsForDate(startDate, endDate, callback);
            $(this).dequeue();
        });
    }

    function breakurl(text) {
        var firsturl, finalurl, urlarray, lengthIE, divtext, totalwords, wordsarray, letterarray, finaltext, iteratornum, newTxt, lastvalue;

        firsturl = text;
        if (firsturl.length > 20) {
            if (!window.ActiveXObject) {
                urlarray = new Array();
                url = firsturl.split('');
                finalurl = url.join('&#8203;');
                return finalurl;
            } else {

                lengthIE = 15;

                divtext = firsturl;
                totalwords = 0;
                wordsarray = new Array();
                letterarray = new Array();
                finaltext = new Array();

                if (divtext.indexOf('&nbsp;') > 0) {
                    divtext = divtext.replace(/&nbsp;/g, ' ');

                }

                a = divtext.replace(/\s/g, ' ');
                wordsarray = a.split(' ');
                for (z = 0; z < wordsarray.length; z++) {
                    if (wordsarray[z].length > 0)
                        totalwords++;
                }
                for (x = 0; x < totalwords; x++) {

                    if (wordsarray[x].length >= lengthIE) {

                        iteratornum = Math.ceil(wordsarray[x].length / lengthIE);
                        newTxt = '';

                        for (i = 0; i < iteratornum; i++) {
                            if (i < iteratornum - 1) {
                                newTxt = newTxt + wordsarray[x].substring(i * lengthIE, (i + 1) * lengthIE) + ' '
                            } else {
                                newTxt = newTxt + wordsarray[x].substring(i * lengthIE, wordsarray[x].length)
                            }
                        }

                        finaltext[x] = newTxt;

                    } else {
                        finaltext[x] = wordsarray[x];
                    }

                }

                var lastvalue = finaltext.join(' ');

                return lastvalue;

            }
        }
        return firsturl;
    }

    /**
     * Toggles event details.
     * Calls getEventDetails method.
     * @param {Object} el The element that trigger it.
     * @param {String} eventID The event ID.
     * @param {Function} callback The callback function with events passed.
     */
    function bubbleEventDetails(el, eventID, callback) {
        $(" .bubble-date-events").hide();
        // Event Id for export to outlook
        subscribe_eventID = eventID;
        //CAL-1141
        var offset, isMousedOut;
        offset = el.offset();
        isMousedOut = true;

        if (!bubbleEventDetailsHTML) {
            bubbleEventDetailsHTML = $(bubbleTemplates.eventDetails).appendTo(document.body).hide();
            bubbleEventDetailsHTML.content = bubbleEventDetailsHTML.find(".content").hide();
            bubbleEventDetailsHTML.tbody = bubbleEventDetailsHTML.find("tbody");
            bubbleEventDetailsHTML.progress = bubbleEventDetailsHTML.find(".progress");
            bubbleEventDetailsHTML.bind("bubbleEventDetailsClose", function (e) {
                if (isMousedOut && bubbleEventDetailsIsOpened) {
                    $(this).fadeOut("fast");
                    bubbleEventDetailsIsOpened = false;
                }
            }).mouseleave(function (e) {
                isMousedOut = true;
            }).mouseenter(function (e) {
                isMousedOut = false;
            });
            bubbleEventDetailsHTML.find("a.close").click(function (e) {
                bubbleEventDetailsHTML.fadeOut("fast");
                bubbleEventDetailsIsOpened = false;
                return false;
            });
            /* calendar export event to outlook */

            // modal load on success
            var calendar_modal = '<div id="modal-demo" class="modal hide fade" style="display: none;"><div class="modal-header"><button type="button" class="close" data-dismiss="modal">x</button><h3>' + exporteventmodaltitleObj1 + '</h3></div><div class="modal-body"><p class="event_success">' + exporteventmodalcontentObj1 + '<p></div><div class="modal-footer"><a class="btn" data-dismiss="modal">Close</a></div></div>';
            $('body').append(calendar_modal);
            bubbleEventDetailsHTML.find(".header #subscribe_cal").click(function (e) {
                var LOCAL_STORAGE_KEY_USERSUBSCRIBEIDLIST = username + '_subscribeIDList';
                // check for calendarID coming from targetting or not
                if (calendarid !== null && targetting_switch == 0) {
                    var subscribe_calendarID = calendarid;
                } else {
                    var subscribe_calendarID = localStorage.getItem(LOCAL_STORAGE_KEY_USERCALENDARID);
                }
                var usersubscribe_calendarIDS_list = localStorage.getItem(LOCAL_STORAGE_KEY_USERSUBSCRIBEIDLIST);
                var usersubscribe_calendarIDS = JSON.parse(usersubscribe_calendarIDS_list);
                var isrecurrent_event = localStorage.getItem(LOCAL_STORAGE_KEY_ISRECURRENTEVENT);
                var recurrent_event_id = localStorage.getItem(LOCAL_STORAGE_KEY_RECURRENTEVENTID);
                if ($.inArray(subscribe_calendarID, usersubscribe_calendarIDS) == -1) {
                    var json = {"is_guest_user": "FALSE", "calendar_id": subscribe_calendarID};
                    var calendar_event_url = subscribe_event_url;
                    $.ajax({
                        url: calendar_event_url,
                        data: json,
                        contentType: "application/json",
                        localCache: true,
                        dataType: "json",
                        success: function (data, textStatus, xhr) {
                            if (xhr.status === 200) {
                                if (!localStorage.getItem(LOCAL_STORAGE_KEY_USERSUBSCRIBEIDLIST)) {
                                    var subcribe_calendarIDS = [];
                                }
                                else {
                                    var subcribe_calendarIDS = localStorage.getItem(LOCAL_STORAGE_KEY_USERSUBSCRIBEIDLIST);
                                    subcribe_calendarIDS = JSON.parse(subcribe_calendarIDS);
                                }
                                subcribe_calendarIDS.push($.trim(subscribe_calendarID));
                                localStorage.setItem(LOCAL_STORAGE_KEY_USERSUBSCRIBEIDLIST, JSON.stringify(subcribe_calendarIDS));
                            }

                            var json_event = {
                                "timezone_offset": "-330",
                                "event_id": subscribe_eventID,
                                "is_recurrent": isrecurrent_event,
                                "recurrent_id": recurrent_event_id,
                                "calendar_id": subscribe_calendarID,
                                "old_event_id": "",
                                "free_busy_status": "B"
                            };
                            if (subscribe_calendarID !== null) {
                                $.ajax({
                                    url: export_event_url,
                                    contentType: "application/json",
                                    data: json_event,
                                    success: function (r)
                                    {
                                        $('#modal-demo').modal('toggle');
                                    },
                                    error: function (error) {
                                        callBackError(error);
                                    },
                                });
                            }
                        },
                        error: function (error) {
                            callBackError(error);
                        }
                    });
                } else {
                    var json_event = {
                        "timezone_offset": "-330",
                        "event_id": subscribe_eventID,
                        "is_recurrent": isrecurrent_event,
                        "recurrent_id": recurrent_event_id,
                        "calendar_id": subscribe_calendarID,
                        "old_event_id": "",
                        "free_busy_status": "B"
                    };
                    if (subscribe_calendarID !== null) {
                        $.ajax({
                            url: export_event_url,
                            contentType: "application/json",
                            data: json_event,
                            success: function (r)
                            {
                                $('#modal-demo').modal('toggle');
                            },
                            error: function (error) {
                                callBackError(error);
                            },
                        });
                    }

                }
                /* calendar export event to outlook end */
            });
        }
        if (bubbleEventDetailsHTML) {
            bubbleEventDetailsHTML.find("h4 a").unbind();
            bubbleEventDetailsHTML.queue(function () {
                $(this).fadeOut("fast");
                $(this).dequeue();
            });
        }
        bubbleEventDetailsHTML.queue(function () {
            bubbleEventDetailsHTML.tbody.html("");
            bubbleEventDetailsHTML.content.hide();
            bubbleEventDetailsHTML.progress.show();
            $(this).find("h4 a").click(function (e) {
            });
            // calendar event window positioning.
            if (bubbleDateEvent == "bubbleDateEventSet") {
                $('.bubble-event-details').css({
                    top: offsetValue.top + "px",
                    left: (offsetValue.left + 146) + "px"
                });
            } else {
                $(this).css({
                    top: (offset.top + 23) + "px",
                    left: (offset.left - 199) + "px"
                });
            }
            $(this).fadeIn("slow");
            bubbleEventDetailsIsOpened = true;
            getEventDetails(eventID, callback);
            $(this).dequeue();
        });
    }

    function EventExtract(json, eventID) {
        var calendar, getFullViewForm, nextDate, startDateTime, localOffset, eventtitlefodate, eventtitlefodateVisible, eventlocationfordate, eventlocationfordateVisible, eventurl, finalEventDate, calendartd;
        getEventsExtract(json, function (months, personID) {
            if (personID) {
                $.cookie("CALENDAR_PERSON", personID, {
                    expires: 5
                });
                calendarPersonID = personID;
            }
            // store single json object into array.
            if ($.type(months) === "object") {
                var month_arr = [];
                var receiveddata = months;
                month_arr.push(receiveddata);
                months = month_arr;
            }
            if (!months && !months.length)
                return false;
            for (var i in months) {

                if (months[i].is_current_month) {
                    $(months[i].day).each(function (index, day) {
                        // Add click toggle date events bubble.
                        calendar = element.find("#events-calendar .calendar");
                        calendartd = calendar.find("td").not(".ui-datepicker-other-month");
                        calendartd = calendartd.not(".ui-datepicker-week-col");
                        calendartd.each(function () {
                            if ($(this).text() == day.date) {
                                calendartd = $(this).find("span").wrapInner("<a href='#'></a>").parent().addClass("has-event");
                            }
                        });
                        calendartd.click(function (e) {

                            // Calendar current month event date fixes.
                            if (todayDate == "todaySet") {
                                date = new Date();
                                year = date.getFullYear();
                                month = date.getMonth() + 1;
                                currentyear = year;
                                currentmonth = month;
                            }

                            getFullViewForm = element.find("#get-full-calendar-view-form");
                            getFullViewForm.find("#start_date").val((currentmonth + "-" + day.date + "-" + currentyear));
                            nextDate = new Date(currentyear, (currentmonth - 1), day.date);
                            nextDate.setDate(nextDate.getDate() + 1);
                            bubbleEventsForDate($(this), (currentyear + "-" + currentmonth + "-" + day.date), (nextDate.getFullYear() + "-" + (nextDate.getMonth() + 1) + "-" + nextDate.getDate()), function (events) {
                                if (events.event) {
                                    $(events.event).each(function (i, event) {
                                        startDateTime = new Date(event.start_date + " " + event.start_time + ":00");
                                        if (event.is_timezone_independent == "NO") {
                                            localOffset = (-1 * startDateTime.getTimezoneOffset() / 60);
                                            startDateTime.setMinutes(startDateTime.getMinutes() + (60 * localOffset));
                                        }
                                        eventtitlefodate = (event.title).replace(/'/g, "&#39;").replace(/"/g, '&#34;');
                                        eventtitlefodateVisible = event.title;
                                        //this is the visible date
                                        eventlocationfordate = event.locations.location;
                                        eventlocationfordateVisible = eventlocationfordate
                                        if (eventlocationfordate != null) {
                                            if (eventlocationfordateVisible.length > 28) {
                                                eventlocationfordateVisible = eventlocationfordateVisible.substring(0, 28) + " ...";
                                            }
                                            if (!window.ActiveXObject && eventlocationfordate) {
                                                eventlocationfordate = breakword(eventlocationfordate);
                                            } else {
                                                if (window.ActiveXObject && eventlocationfordate) {
                                                    eventlocationfordate = breakwordIE(eventlocationfordate, 17);
                                                }
                                            }
                                        }

                                        eventurl = deeplink_to_event + event.id;

                                        finalEventDate = $("<tr><td><input class='text' type='text' disabled='disabled' /></td><td><div class='div_event_name_cal' style=\"width:160px; word-wrap:'break-word'\" ><a href='#' title='" + eventtitlefodate + "' rel='" + event.id + "' id='" + event.id + "'> " + eventtitlefodate + "</a></div></td><td><div class='div_event_time' style=\"width:52px;\">" + startDateTime.toLocaleTimeString().replace(/(:[0-9]{1,2})( [a-zA-Z]{2}$)/, "$2") + "</div></td><td><div  title=\"" + eventlocationfordate + "\" class='div_event_name_cal' style=\"width:154px; word-wrap:'break-word'\" >" + ((eventlocationfordateVisible) ? eventlocationfordateVisible : "") + "</div></td></tr>").appendTo(bubbleEventsForDateHTML.tbody)
                                        getEventTitleForDate(finalEventDate, event.id, eventtitlefodateVisible);
                                        bubbleEventsForDateHTML.progress.hide();
                                        bubbleEventsForDateHTML.content.show();

                                        /* Code for diplaying popup on click of item from event list view (shown when click on date within calendar) */
                                        // calendar event window positioning.
                                        offsetValue = $('.bubble-date-events').offset();
                                        finalEventDate.find("a").click(function (e) {
                                            getFullViewForm = element.find("#get-full-calendar-view-form");
                                            getFullViewForm.find("#start_date").val("");
                                            // calendar event window positioning.
                                            bubbleDateEvent = "bubbleDateEventSet";

                                            bubbleEventDetails($(this), $(this).attr("rel"), function (eventDetails) {
                                                if (eventDetails) {
                                                    changeStart = $.datepicker.formatDate('dd M yy', new Date((eventDetails.start_date).replace(/-/g, '/')));
                                                    changeEnd = $.datepicker.formatDate('dd M yy', new Date((eventDetails.end_date).replace(/-/g, '/')));
                                                    cal_start_date = eventDetails.start;
                                                    cal_start_time = cal_start_date.split('T')[1];
                                                    cal_start_hr = cal_start_time.split(':');
                                                    event_timee = cal_start_hr[0] + ":" + cal_start_hr[1];
                                                    cal_end_date = eventDetails.end;
                                                    cal_end_time = cal_end_date.split('T')[1];
                                                    cal_end_hr = cal_end_time.split(':');
                                                    end_timee = cal_end_hr[0] + ":" + cal_end_hr[1];
                                                    startDateTime = new Date(changeStart + " " + event_timee + ":00");
                                                    endDateTime = new Date(changeEnd + " " + end_timee + ":00");
                                                    if (eventDetails.is_timezone_independent == "NO") {
                                                        localOffset = (-1 * startDateTime.getTimezoneOffset() / 60);
                                                        startDateTime.setMinutes(startDateTime.getMinutes() + (60 * localOffset));
                                                        localOffset = (-1 * endDateTime.getTimezoneOffset() / 60);
                                                        endDateTime.setMinutes(endDateTime.getMinutes() + (localOffset * 60));
                                                    }
                                                    starts = (startDateTime.toDateString().replace(/[a-zA-Z]{3,4}/, "") + ", " + startDateTime.toLocaleTimeString().replace(/(:[0-9]{1,2})( [a-zA-Z]{2}$)/, "$2"));
                                                    ends = (endDateTime.toDateString().replace(/[a-zA-Z]{3,4}/, "") + ", " + endDateTime.toLocaleTimeString().replace(/(:[0-9]{1,2})( [a-zA-Z]{2}$)/, "$2"));
                                                    starts = starts.substring(4, 7) + " " + starts.substring(0, 4) + " " + (starts.substring(7, starts.length));

                                                    ends = ends.substring(4, 7) + " " + ends.substring(0, 4) + " " + (ends.substring(7, ends.length));

                                                    switch (eventDetails.security_level) {
                                                        case "Global":
                                                            securityIcon = "<img src='/m/eds/hrview/images/global.png' alt='Global' />"
                                                            break;
                                                        case "Public":
                                                            securityIcon = "<img src='/m/eds/hrview/images/group.png' alt='Public' />"
                                                            break;
                                                        default:
                                                            securityIcon = "<img src=/m/eds/hrview/images/locked.png' alt='Private' />"
                                                    }

                                                    eventtitlename = (eventDetails.title).replace(/'/g, "&#39;").replace(/"/g, '&#34;');
                                                    ;
                                                    eventtitlenameVisible = eventtitlename;
                                                    if (eventtitlename.length > 30) {
                                                        eventtitlenameVisible = eventtitlenameVisible.substring(0, 30) + " ...";
                                                    }
                                                    if (!window.ActiveXObject) {
                                                        eventtitlename = breakword(eventtitlename);
                                                    } else {
                                                        eventtitlename = breakwordIE(eventtitlename, 20);
                                                    }
                                                    eventtitlename = (eventtitlename).replace(/'/g, "&#39;").replace(/"/g, '&#34;');
                                                    eventlocationnname = eventDetails.locations.location;
                                                    eventlocationnnameVisible = eventlocationnname;

                                                    if (eventlocationnname) {
                                                        if (eventlocationnname.length > 30) {
                                                            eventlocationnnameVisible = eventlocationnnameVisible.substring(0, 30) + " ...";
                                                        }
                                                        if (!window.ActiveXObject) {
                                                            eventlocationnname = breakword(eventDetails.locations.location);
                                                        } else {
                                                            eventlocationnname = breakwordIE(eventlocationnname, 20);
                                                        }
                                                    }

                                                    event_desc = eventDetails.details;
                                                    event_desc = " " + event_desc + " ";
                                                    url_array = [];
                                                    counter = 0;

                                                    if (event_desc.length > 300) {
                                                        indexOfEnd = event_desc.indexOf(" ", 300);
                                                        event_desc = event_desc.substring(0, 300) + " ...";
                                                    }
                                                    event_desc = 'NXNYNX~ ' + event_desc + ' NXNYNX~';
                                                    while (true) {
                                                        new_url = "";
                                                        protocol_type = '';
                                                        url_found = false;
                                                        if (event_desc.indexOf('http://') > -1 || event_desc.indexOf('https://') > -1) {
                                                            if (event_desc.indexOf('http://') > -1) {
                                                                protocol_type = 'http://';
                                                            } else {
                                                                protocol_type = 'https://';
                                                            }
                                                            url_found = true;
                                                        } else if (event_desc.indexOf("www.") > -1) {
                                                            indexOfWWW = event_desc.indexOf("www.");
                                                            substring_to_check = event_desc.substring(indexOfWWW - 1, indexOfWWW);
                                                            if ((substring_to_check != "://") && ((substring_to_check == " ") || (substring_to_check == ",") || (substring_to_check == ":") || (substring_to_check == ";"))) {
                                                                protocol_type = "www";
                                                                url_found = true;
                                                            }
                                                        }
                                                        if (url_found) {
                                                            part_before_url = '';
                                                            part_after_url = '';
                                                            desc_part2 = event_desc.substring(event_desc.indexOf(protocol_type), event_desc.length);
                                                            desc_part3 = '';
                                                            if (desc_part2.indexOf(' ') > -1) {
                                                                desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.indexOf(' '));
                                                            } else if (desc_part2.indexOf(',') > -1) {
                                                                desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.indexOf(','));
                                                            } else if (desc_part2.indexOf('"') > -1) {
                                                                desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.indexOf('"'));
                                                            } else if (desc_part2.indexOf('\'') > -1) {
                                                                desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.indexOf('\''));
                                                            } else {
                                                                desc_part3 = desc_part2.substring(desc_part2.indexOf(protocol_type), desc_part2.length - 6);
                                                            }

                                                            url_array[counter] = desc_part3;
                                                            event_desc = event_desc.replace(desc_part3, "##^^##");
                                                            counter++;
                                                        } else {
                                                            break;
                                                        }
                                                    }

                                                    url_array_email = [];
                                                    counter = 0;
                                                    while (true) {
                                                        if (event_desc.indexOf('@') > -1) {
                                                            part1 = event_desc.substring(0, event_desc.indexOf('@'));
                                                            mail_name = part1.substring(part1.lastIndexOf(' '), part1.length);
                                                            part2 = event_desc.substring(event_desc.indexOf('@'), event_desc.length);
                                                            domain_name = part2.substring(0, part2.indexOf(' '));
                                                            found_email = mail_name + domain_name;
                                                            url_array_email[counter] = found_email;
                                                            event_desc = event_desc.replace(found_email, "%*%*%*");
                                                            counter++;
                                                        } else {
                                                            break;
                                                        }
                                                    }

                                                    if (!window.ActiveXObject) {
                                                        if (event_desc.indexOf('<a href') > -1) {
                                                            part2 = event_desc.substring(event_desc.indexOf('<a href='), event_desc.indexOf('a>') + 2);
                                                            event_desc = event_desc.replace(part2, "^^##^^");
                                                        }
                                                        event_desc = event_desc.replace(/\s+/g, ' ');
                                                    }

                                                    for (var i = 0; i < url_array.length; i++) {
                                                        event_url = url_array[i];
                                                        if (event_url.indexOf("http://") > -1 || event_url.indexOf("https://") > -1) {
                                                            event_url = "<a href='" + event_url + "' target='_blank'><u>" + breakurl(event_url) + "</u></a>";
                                                        } else {
                                                            event_url = "<a href='http://" + event_url + "' target='_blank'><u>" + breakurl(event_url) + "</u></a>";
                                                        }
                                                        event_desc = event_desc.replace("##^^##", event_url);
                                                    }

                                                    for (var i = 0; i < url_array_email.length; i++) {
                                                        mail_to = url_array_email[i];
                                                        mail_to = "<a href='mailto:" + mail_to + "'><u>" + breakurl(mail_to) + "</u></a>";
                                                        event_desc = event_desc.replace("%*%*%*", mail_to);
                                                    }

                                                    event_desc = event_desc.replace('NXNYNX~', '');
                                                    event_desc = event_desc.replace(' NXNYNX~', '');
                                                    eventDetailsUpcoming = event_desc;

                                                    cal_list = "";
                                                    cal_tooltip = "";
                                                    more_cal = false;
                                                    $(eventDetailsXML).find("calendar").each(function (i) {
                                                        cal_tooltip = cal_tooltip + $(this).text() + " , ";
                                                        if (i < 3) {
                                                            cal_list = cal_list + $(this).text()
                                                            if (i <= 2) {
                                                                cal_list = cal_list + " , ";
                                                            }
                                                        } else {
                                                            more_cal = true;
                                                        }
                                                    });

                                                    if (more_cal) {
                                                        cal_list = cal_list + "...";
                                                    } else {
                                                        cal_list = cal_list.substring(0, cal_list.lastIndexOf(","));
                                                    }
                                                    cal_tooltip = cal_tooltip.substring(0, cal_tooltip.lastIndexOf(","));
                                                    if ($.trim(eventDetails.details) == "") {
                                                        eventDetailsUpcoming = "No Details Available";
                                                    }

                                                    bubbleEventDetailsHTML.tbody.html("<tr class='calendar-name'><th>Name:</th><td title='" + eventDetails.calendars.calendar.content + "'>" + eventDetails.calendars.calendar.content + "</td></tr><tr class='event'><th><span>Event</span></th><td>" + securityIcon + "</td></tr><tr class='event-name'><th>Name:</th><td><div title=\"" + eventtitlename + "\" style=\"WORD-WRAP: break-word;width:174px;padding-top:6px;\" >" + eventtitlenameVisible + "</div></td></tr><tr class='type'><th>Type:</th><td><span>" + eventDetails.event_type.content + "</span></td></tr><tr class='location'><th><span>Location</span></th><td><div  title=\"" + eventlocationnname + "\"   style=\"WORD-WRAP: break-word;width:174px;\" >" + ((eventlocationnnameVisible) ? eventlocationnnameVisible : "") + "</div></td></tr><tr class='start-date'><th>Start Date:</th><td>" + starts + "</td></tr><tr class='end-date'><th>End Date:</th><td>" + ends + "</td></tr><tr class='details'><th>Details:</th><td> <div  style=\"WORD-WRAP: break-word;width:174px;\" >" + eventDetailsUpcoming + "</div></td></tr>").find("tr.type span").css("background", eventDetails.event_type.color);
                                                    bubbleEventDetailsHTML.progress.hide();
                                                    bubbleEventDetailsHTML.content.show();

                                                }
                                            });
                                            return false;
                                        });



                                    });
                                    bubbleEventsForDateHTML.find("tr:even").addClass("even");
                                } else if (!events.event) {
                                    $("<tr><td></td><td>No more events for this date.</td><td></td><td></td></tr>").appendTo(bubbleEventsForDateHTML.tbody);
                                    bubbleEventsForDateHTML.progress.hide();
                                    bubbleEventsForDateHTML.content.show();
                                }
                            });
                            return false;
                        });
                    });
                }
            }
        });

    }

    /* functions added to handle security issues and encoding
     */
    function getEventList(finalEventList, eventId, eventtitle) {
        var eventAnchorEl, currEventitle, neweventtitle;
        eventAnchorEl = finalEventList.find("#" + eventId);
        eventAnchorEl.hide();
        eventAnchorEl.html(eventtitle);
        currEventitle = eventAnchorEl.text();
        neweventtitle = (currEventitle.length < 45 ? currEventitle : currEventitle.substring(0, 45) + "...");
        if (!window.ActiveXObject) {
            var neweventtitle = breakword(neweventtitle).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        } else {
            neweventtitle = neweventtitle.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        eventAnchorEl.html(neweventtitle);
        eventAnchorEl.show();
    }

    function getEventTitleForDate(finalEventList, eventId, eventtitle) {
        var self, eventAnchorEl, currEventitle, neweventtitle;
        self = this;
        eventAnchorEl = finalEventList.find("#" + eventId);
        eventAnchorEl.hide();
        eventAnchorEl.html(eventtitle);
        currEventitle = eventAnchorEl.text();
        neweventtitle = (currEventitle.length < 28 ? currEventitle : currEventitle.substring(0, 28) + "...");
        if (!window.ActiveXObject) {
            neweventtitle = breakword(neweventtitle).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        } else {
            neweventtitle = neweventtitle.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        eventAnchorEl.html(neweventtitle);
        eventAnchorEl.show();
    }
    }
    setTimeout(function () {
        if (federation3lHandler.Utils.getTokenStatus()) {
            call_calendar();
        } else {
                 ge_calendar();
        }
    }, 1500);
}

ge_quicktrans = function () {
    var lookupurl, deeplinkurl, content, session_role, qtrolemapping, role_array, role_id, testvar;
    deeplinkurl = settings.ge_quick_transaction.qt_role_mapping.Data[1].link;
    content = settings.ge_quick_transaction.content;
    session_role = settings.ge_quick_transaction.session_role;
    qtrolemapping = settings.ge_quick_transaction.qt_role_mapping.roles;
    role_id = settings.ge_quick_transaction.qt_role_mapping.roles;
    role_array = [];
    var takeAction =(location.search.indexOf("GE_TAKE_ACTION")==-1)?true:false;

    if(glbSiteName == "GE_MNGRVIEW"){
        lookupurl = glbDSWSCmpURL + 'WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_GetJsonData?serviceOp=GE_QCKTRANSACTN_PERSONALIZ_GET&addHeader=GE_SENTRY&query={search_term}*&page={page}';
    }else {
        lookupurl = glbDSWSCmpURL + 'WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_GetJsonData?serviceOp=GE_QUICK_TRANSACTION_GET&addHeader=GE_SENTRY&query={search_term}*&page={page}&role={role}';
    }
    /* Execute links for quicktransactions */
    //if($("#sidebar-9189").length===0){
        quickTransLinks(glbSiteName,takeAction);
    //}


    $.each(role_id, function (key, value) {
        role_array.push(value);
    });
    rolesInArray = $.inArray(session_role, role_array);
    if (rolesInArray == -1) {
        $(".pane-ge-quick-transaction-ge-quick-transaction").addClass("hide");
    }

    $('#ge-quick-transaction-form fieldset.collapsible a.fieldset-title').click(function () {
        $('#ge-quick-transaction-form fieldset.collapsible').each(function () {
            $(this).addClass('collapsed');
            $(this).find('.fieldset-wrapper').hide();
            $(this).find('#qt_lookup').hide();
            $(this).find('input.form-text').val('Enter a name or SSO.').css({color: "#cccccc"});
        });
        $(this).parent().parent().parent().removeClass('collapsed');
        $(this).parent().parent().parent().find('.fieldset-wrapper').show();
    });

    $.each(content, function (i, action) {
        actionname = "#" + action.name.replace(/_/g, "");
        actiontype = action.type;
        actionicon = action.icon;
        onehrQTLookup(session_role, qtrolemapping, lookupurl, deeplinkurl, actionname, actiontype, actionicon);
    });
    // serach icon
    $('.qt_text .controls').append("<i class='icon-ico_search_lg'></i>");
};

function quickTransLinks(view,takeAction){
    $("#sidebar-4157").html("");
    if(takeAction==false){$("#sidebar-9189").html("");}

    var QTLinksMVJSON={},QTLinksHRVJSON={};
    var extURLPrefix = "/el/QT?url=";
        
    var session_role = settings.ge_quick_transaction.session_role;
    var qtrolemapping = settings.ge_quick_transaction.qt_role_mapping.roles;
    var deeplinkurl = extURLPrefix+settings.ge_quick_transaction.qt_role_mapping.Data[1].link;
    var legacyValidator='non-legacy';
    if(view == "GE_MNGRVIEW"){
        lookupurl = glbDSWSCmpURL + 'WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_GetJsonData?serviceOp=GE_QCKTRANSACTN_PERSONALIZ_GET&addHeader=GE_SENTRY&query={search_term}*&page={page}';
    }else {
        lookupurl = glbDSWSCmpURL + 'WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_GetJsonData?serviceOp=GE_QUICK_TRANSACTION_GET&addHeader=GE_SENTRY&query={search_term}*&page={page}&role={role}';
    }

    QTLinksMVJSON.items=[{
    "title": "Create a Vacancy",
        "link": extURLPrefix+"https://ohrapps.corporate.ge.com/OHRVacancy_app-GEVacancyUI-context-root/faces/GEVacancyHome?",
        "icon":false,
        "accordion":false,
        "search":false,
        "type":null
   },{
    "title": "End Employment",
        "link": "https://ohrapps.corporate.ge.com/GEDataManagement-root/faces/GETranSelection?varTransType=EndEmployment",
        "icon":true,
        "accordion":true,
        "search":false,
        "type":"EndEmployment"
   },{
    "title": "Request Contingent Worker",
        "link": extURLPrefix+"http://supportcentral.ge.com/sc_shortlink_redirect.asp?supportcentral.ge.com/*ContingentWorkforce",
        "icon":false,
        "accordion":false,
        "search":false,
        "type":""
   },{
    "title": "Initiate Leave of Absence",
        "link": "https://ohrapps.corporate.ge.com/GEDataManagement-root/faces/GETranSelection?varTransType=LOA&amp;varEmpSSO",
        "icon":true,
        "accordion":true,
        "search":false,
        "type":"LOA"
   },{
    "title": "Update Work Schedule",
        "link": "https://ohrapps.corporate.ge.com/GEDataManagement-root/faces/GETranSelection?varTransType=EmployeeWorkSchedule&amp;varEmpSSO",
        "icon":true,
        "accordion":true,
        "search":false,
        "type":"EmployeeWorkSchedule"
   },{
    "title": "Create New Org/People Leader/HRM",
        "link": "https://ohrapps.corporate.ge.com/GEDataManagement-root/faces/GETranSelection?varTransType=NewOrgMgrHrm&amp;varEmpSSO",
        "icon":true,
        "accordion":true,
        "search":false,
        "type":"NewOrgMgrHrm"
   },{
    "title": "Change Location",
        "link": "https://ohrapps.corporate.ge.com/GEDataManagement-root/faces/GETranSelection?varTransType=Worklocation&amp;varEmpSSO",
        "icon":true,
        "accordion":true,
        "search":false,
        "type":"Worklocation"
   },{
        "title": "Give PD Insight",
        "link": extURLPrefix+"https://pd.ge.com/insights/add",
        "icon":false,
        "accordion":false,
        "search":false,
        "type":null
   }];
  QTLinksHRVJSON.items=[{
        "title": "Create a Vacancy",
        "link": extURLPrefix+"https://ohrapps.corporate.ge.com/OHRVacancy_app-GEVacancyUI-context-root/faces/GEVacancyHome?",
        "icon":false,
        "accordion":false,
        "search":false,
        "type":null
    },{
        "title": "End Employment",
        "link": "https://ohrapps.corporate.ge.com/GEDataManagement-root/faces/GETranSelection?varTransType=EndEmployment",
        "icon":true,
        "accordion":true,
        "search":false,
        "type":"EndEmployment"
    },{
        "title": "Change People Leader/HRM/Org",
        "link": "https://ohrapps.corporate.ge.com/GEDataManagement-root/faces/GETranSelection?varTransType=NewOrgMgrHrm&amp;varEmpSSO",
        "icon":true,
        "accordion":true,
        "search":false,
        "type":"NewOrgMgrHrm"
    },{
        "title": "Correct Job/Band in current role",
        "link": "https://ohrapps.corporate.ge.com/GEDataManagement-root/faces/GETranSelection?varTransType=InRoleJobChange&amp;varEmpSSO",
        "icon":true,
        "accordion":true,
        "search":false,
        "type":"InRoleJobChange"
    },{
    "title": "Change Salary",
        "link": "https://ohrapps.corporate.ge.com/GEDataManagement-root/faces/GETranSelection?varTransType=SalaryChange&amp;varEmpSSO",
        "icon":true,
        "accordion":true,
        "search":false,
        "type":"SalaryChange"
    },{
        "title": "Update Bonus Target",
        "link": "https://ohrapps.corporate.ge.com/GEDataManagement-root/faces/GETranSelection?varTransType=BonusTarget&amp;varEmpSSO",
        "icon":true,
        "accordion":true,
        "search":false,
        "type":"BonusTarget"
    },{
        "title": "Change Location",
        "link": "https://ohrapps.corporate.ge.com/GEDataManagement-root/faces/GETranSelection?varTransType=Worklocation&amp;varEmpSSO",
        "icon":true,
        "accordion":true,
        "search":false,
        "type":"Worklocation"
    },{
      "title": "Give PD Insight",
      "link": extURLPrefix+"https://pd.ge.com/insights/add",
      "icon":false,
      "accordion":false,
      "search":false,
      "type":null
      }];
      var QTlinksView=(glbSiteName=='GE_MNGRVIEW')?QTLinksMVJSON:QTLinksHRVJSON;
          QTlinksView.legacy=legacyValidator;
          QTlinksView.takeAction=takeAction;
      var quickTrans = new EJS({url: '/m/eds/hrview/templates/client_list/quick_transactions.ejs?v='+glbFileVerNo}).render(QTlinksView);
      $(".portlet-container").prepend(quickTrans);
      //$("#sidebar-4157").prepend(quickTrans);
      if(takeAction==false){$("#sidebar-9189").prepend(quickTrans);}
      /*remove collapse functionallity to right bar */
      $(".cms-node-sidebar-section .icon-ico_chevron_down_lg").remove();
      $(".cms-node-sidebar-section .quick-transaction-header").attr("href","");
      addEventsQT();

      $.each(QTlinksView.items,function(index,value){
        if(value.accordion){
          addSearchEventsQT(value, session_role, qtrolemapping, lookupurl, deeplinkurl);
        }
      });
}

function addEventsQT(){
    /*quick transactions*/
    /*var popup = $(".sidebar-menu li .accordion-profile-data").html();
    $".transaction-list li .accordion-profile-data").append(popup);*/

    var headerFlag = 0;
    $(".transaction-list li span.qtLink").click(function(){
        $(this).next(".accordion-profile-data").slideToggle(400, function(){
            $(this).find("input").focus();
        });
    });

    $(".quick-transaction-header").click(function(){
        if (headerFlag === 0){
            $(".quick-transaction-header .header-section i").addClass("icon-rotate-180");
            headerFlag = 1;
            if($(".portlet-container ul.transaction-list .accordion-profile-data:visible").length==1){
                $(".portlet-container ul.transaction-list .accordion-profile-data:visible .qt_lookup").hide();
                $(".portlet-container ul.transaction-list .accordion-profile-data:visible input").val("");
                $(".portlet-container ul.transaction-list .accordion-profile-data:visible").hide();
            }
        }else if(headerFlag === 1){
            $(".quick-transaction-header .header-section i").removeClass("icon-rotate-180");
            headerFlag = 0;
        }
    });
    $(".quick-transaction input[type='search']").focusout(function(){
            if($(this).closest("ul").find("#qt_lookup").css("display")==="none"){
                 $(this).closest(".accordion-profile-data").hide();
                 $(this).closest(".accordion-profile-data").find("#qt_lookup").hide();
                 $(this).closest(".accordion-profile-data").find("input").val("");
            }else{
                 if(($(this).closest( "ul").find("#qt_lookup").is(":hover")===false) || ($(this).closest(".accordion-profile-data").is(":hover")===false)){
                    $(this).closest(".accordion-profile-data").hide();
                    $(this).closest(".accordion-profile-data").find("#qt_lookup").hide();
                    $(this).closest(".accordion-profile-data").find("input").val("");
                }
            }

        });
}

function addSearchEventsQT(node, session_role, qtrolemapping, lookupurl, deeplinkurl){
    var searchTimeout, activeIndex = -1, count, activeEl, searchSuggestions_progress, searchSuggestions_results, searchSuggestions_more;
    var searchInput = $("ul#"+node.type+" input[data-ws='PS']");
    var searchSuggestions = $("ul#"+node.type+" .qt_lookup");
    searchSuggestions_progress = searchSuggestions.find(".progress");
    searchSuggestions_results = searchSuggestions.find("ul");
    searchSuggestions_more = searchSuggestions.find(".see-more").hide();// set see more var
    searchInput.val(unescape(searchInput.val()));
    inputdata = "";
    searchSuggestions.isMouseLeave = false;
    searchSuggestions.mouseenter(function (e) {
        searchSuggestions.isMouseLeave = false;
    }).mouseleave(function () {
        searchSuggestions.isMouseLeave = true;
    });
    var pressedKey = {
        SHIFT: 16,
        UP: 38,
        DOWN: 40,
        DEL: 46,
        TAB: 9,
        RETURN: 13,
        ESC: 27,
        COMMA: 188,
        PAGEUP: 33,
        PAGEDOWN: 34,
        BACKSPACE: 8
    };
    var defaultValue = "Enter a name or SSO";
    searchInput.val("");
    searchInput.unbind('blur');
    searchInput.unbind('focus');
    searchInput.blur(function (e) {
        /*if ($.trim(searchInput.val()) === "") {
            searchInput.val(defaultValue).css({color: "#cccccc"});
        }*/
        if (!searchSuggestions.isMouseLeave) {
            return false;
        }
        searchSuggestions.hide();
        $("#quick-transaction-collapse").css("overflow","hidden");
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        searchSuggestions.isOpened = false;
        return false;
    });
    /*if ($.trim(searchInput.val()) === "") {
        searchInput.val(defaultValue).css({color: "#cccccc"});
    }*/
    searchInput.focus(function (e) {
        if ($(this).val() === defaultValue) {
            $(this).val("");
        }
    }).bind("keyup", function (e) { // Key up function
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        var $input, value, jsonInput, code;
        $input = $(this);
        value = $input.val().substring($input.val().lastIndexOf(';') + 1, $input.val().length);
        jsonInput = {
            userDirectoryLookup: lookupurl,
        }
        code = (e.keyCode ? e.keyCode : e.which);
        if (searchSuggestions.isOpened && (code === pressedKey.RETURN) && (activeIndex > -1)) {
            searchSuggestions.find("a.active").trigger("click");
            return false;
        }// Hide search suggestions div and set status false
        if ((code === pressedKey.ESC) || ((code === pressedKey.BACKSPACE) && (value === "")) || ((code === pressedKey.RETURN) && (value === "") && (activeIndex > -1))) {
            searchSuggestions.hide();
            $("#quick-transaction-collapse").css("overflow","hidden");
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            searchSuggestions.isOpened = false;
            return false;
        }// move active index using keyboard
        if (searchSuggestions.isOpened && (code === pressedKey.DOWN)) {
            count = searchSuggestions.find("a").length;
            $(searchSuggestions.find("a")[activeIndex]).removeClass("active");
            (activeIndex < (count - 1)) ? (activeIndex += 1) : (activeIndex = 0);
            activeEl = $(searchSuggestions.find("a")[activeIndex]).addClass("active");
            searchSuggestions_results[0].scrollTo(activeEl.position().top);
            return false;
        }
        if (searchSuggestions.isOpened && (code === pressedKey.UP)) {
            count = searchSuggestions.find("a").length;
            $(searchSuggestions.find("a")[activeIndex]).removeClass("active");
            (activeIndex > 0) ? (activeIndex -= 1) : (activeIndex = (count - 1));
            activeEl = $(searchSuggestions.find("a")[activeIndex]).addClass("active");
            searchSuggestions_results[0].scrollTo(activeEl.position().top);
            return false;
        }
        if (((value !== "") && (value !== defaultValue)) && ((code === pressedKey.BACKSPACE) || (code === pressedKey.RETURN) || ((code >= 46) && (code <= 105)) || (code === pressedKey.SHIFT) || (code === 17) || ((e.type === "keyup") && (!e.keyCode)))) {
            searchTimeout = setTimeout(function () {
                searchSuggestions.isOpened = true;
                searchSuggestions.show();
                $("#quick-transaction-collapse").css("overflow","visible");
                searchSuggestions_results.hide();
                searchSuggestions_more.hide();
                searchSuggestions_progress.show();
                var page = 1;// Function where the API call is made it, lookupurl as the URL
                getDirectoryList(session_role, qtrolemapping, "", jsonInput, page, value, function (directoryList) {
                    var page = 1;
                    searchSuggestions_results.html("");
                    if(directoryList.statuscode == "EXCEPTION"){ //msg if theres an error on response
                         $("<li class='sug'><p>" + directoryList.exceptiondisplaymsg + "</p></li>").appendTo(searchSuggestions_results);
                         searchSuggestions_results.addClass("noData");
                    } else if (directoryList.statuscode != undefined && directoryList.statuscode == "OUTAGE") {
                        $("<li class='sug'><p>" + directoryList.statusmesssage + "</p></li>").appendTo(searchSuggestions_results);
                        searchSuggestions_results.addClass("noData");
                    } else if (directoryList.data.length) {// if theres data
                        $(directoryList.data).each(function (i, user) {// build element for each response element
                            if(glbSiteName == "GE_MNGRVIEW"){
                                var trans_link = deeplinkurl + "?varTransType=" + node.type + "&varEmpSSO=" + user.sso;
                                //$("<li><a href=" + trans_link + " target='_blank' rel='" + user.sso + "'><span class='name'>" + user.lastName + ', ' + user.firstName + "</span>" + (user.sso ? " <span class='business'>(" + user.sso + ")</span>" : "") + "</a></li>").appendTo(searchSuggestions_results);
                                $("<li><a href=" + trans_link + " target='_blank' rel='" + user.sso + "'>" + user.lastName + ', ' + user.firstName + (user.sso ? " (" + user.sso + ")" : "") + "</a></li>").appendTo(searchSuggestions_results);
                            }else{
                                var trans_link = deeplinkurl + "?varTransType=" + node.type + "&varEmpSSO=" + user.publicData.sso;
                                //$("<li><a href=" + trans_link + " target='_blank' rel='" + user.publicData.sso + "'><span class='name'>" + user.publicData.lastName + ', ' + user.publicData.firstName + "</span>" + (user.publicData.sso ? " <span class='business'>(" + user.publicData.sso + ")</span>" : "") + "</a></li>").appendTo(searchSuggestions_results);
                                $("<li><a href=" + trans_link + " target='_blank' rel='" + user.publicData.sso + "'>" + user.publicData.lastName + ', ' + user.publicData.firstName + (user.publicData.sso ? " (" + user.publicData.sso + ")" : "") + "</a></li>").appendTo(searchSuggestions_results);

                            }
                        });
                        searchSuggestions_results.removeClass("noData");
                    }else {// if theres no response
                        if(glbSiteName == "GE_MNGRVIEW"){
                            $("<li><p>Cannot load '" + value + "'</p></li><li class='sug'><p>You may only search your employees.</p></li>").appendTo(searchSuggestions_results);
                        }else{
                            $("<li><p>Couldn't find '" + value + "'</p></li><li class='sug'><p>Please check your text and try again</p></li>").appendTo(searchSuggestions_results);
                        }
                        searchSuggestions_results.addClass("noData");
                    }
                    searchSuggestions_progress.hide();
                    searchSuggestions_results.show();
                    $(".portlet-container ul.transaction-list .accordion-profile-data:visible .qt_lookup li a").click(function() {
                        $(".portlet-container ul.transaction-list .accordion-profile-data:visible .qt_lookup").hide();
                        $(".portlet-container ul.transaction-list .accordion-profile-data:visible input").val("");
                        $(this).closest("input").blur();
                        $(this).closest(".accordion-profile-data").addClass("hide");
                        setTimeout(function(){ //this timeout was added due to something in the backend remove all css style to .accordion-profile-data
                            $(".portlet-container ul.transaction-list .accordion-profile-data").each(
                                function(){
                                    if($(this).css("display")==="block"){
                                        $(this).hide();
                                    }
                            });
                        },1000);
                    });
                    searchSuggestions_more.unbind();
                    searchSuggestions_results.jScrollPane({scrollbarWidth: 7, scrollbarMargin: 1, animateTo: true, animateInterval: 50, animateStep: 3});
                    if ((searchSuggestions_results.find("li").length < 4)) {
                        searchSuggestions_results.jScrollPaneRemove();
                    }
                    if (directoryList.next) { //if there are more result pages, add event listener to see_more element
                        searchSuggestions_more.css('display', 'block').click(function (e) {
                            page += 1;
                            searchSuggestions_progress.show();
                            //getDirectoryList(session_role, qtrolemapping, lookupurl, jsonInput, page, value, function (directoryList) {// call search function again
                            getDirectoryList(session_role, qtrolemapping, "", jsonInput, page, value, function (directoryList) {
                                if (directoryList.data.length) {
                                    $(directoryList.data).each(function (i, user) {// add new elements to the list
                                        if(glbSiteName == "GE_MNGRVIEW"){
                                            var trans_link = deeplinkurl + "?varTransType=" + node.type + "&varEmpSSO=" + user.sso;
                                            $("<li><a href=" + trans_link + " target='_blank' rel='" + user.sso + "'><span class='name'>" + user.lastName + ', ' + user.firstName + "</span>" + (user.sso ? " <span class='business'>(" + user.sso + ")</span>" : "") + "</a></li>").appendTo(searchSuggestions_results);
                                        }else{
                                            var trans_link = deeplinkurl + "?varTransType=" + node.type + "&varEmpSSO=" + user.publicData.sso;
                                            $("<li><a href=" + trans_link + " target='_blank' rel='" + user.publicData.sso + "'><span class='name'>" + user.publicData.lastName + ', ' + user.publicData.firstName + "</span>" + (user.publicData.sso ? " <span class='business'>(" + user.publicData.sso + ")</span>" : "") + "</a></li>").appendTo(searchSuggestions_results);
                                        }
                                    });
                                    $(".portlet-container ul.transaction-list .accordion-profile-data:visible .qt_lookup li a").click(function() {
                                        $(".portlet-container ul.transaction-list .accordion-profile-data:visible .qt_lookup").hide();
                                        $(".portlet-container ul.transaction-list .accordion-profile-data:visible input").val("");
                                    });
                                    if (directoryList.next && (directoryList.next === "FALSE")) {
                                        searchSuggestions_more.unbind().hide// remove see:more element if there no more result pages
                                    }
                                    count = searchSuggestions.find("a").length; //update number of results
                                    $(searchSuggestions.find("a")[activeIndex]).removeClass("active");
                                    activeIndex = (count - 1);// Remove and add active class and set active status
                                    activeEl = $(searchSuggestions.find("a")[activeIndex]).addClass("active");
                                    searchSuggestions_progress.hide();
                                    searchSuggestions_results.jScrollPane({scrollbarWidth: 7, scrollbarMargin: 1, animateTo: true, animateInterval: 50, animateStep: 3});
                                    searchSuggestions_results[0].scrollTo(searchSuggestions_results.data('jScrollPaneMaxScroll'));
                                    searchInput.focus();
                                } else {
                                    $("<li><p>No more results found.</p></li>").appendTo(searchSuggestions_results);
                                }
                            });
                            return false;
                        });
                    }
                });
            },1000);
        }
    });
}

function getDirectoryList(session_role, qtrolemapping, lookupurl, searchurl, page, value, callback) {
    //Remove the white spaces at the start and at the end of the string.
    value=$.trim(value);
    var apiurl, userDirectoryLookup;
    userDirectoryLookup = searchurl.userDirectoryLookup.replace("{count}", "5");
    if ($.isFunction(page)) {
        callback = page;
        page = 1;
    }
    var role_val = [];
    var element = '#' + $(':focus').closest('.accordion-body').attr('id');
    roleObj = qtrolemapping;
    $.each(roleObj, function (key, val) {
        if (session_role == key) {
            role_val = val;
        }
    });
    apiurl = userDirectoryLookup.replace("{page}", page.toString()).replace("{search_term}", value).replace("{role}", role_val);
    $.ajax({
        url: apiurl,
        dataType: "json",
        contentType: "application/json",
        success: function (data, instID) {
            var directoryList = data;
            if ($.isFunction(callback)) {
                callback(directoryList, instID);
            }
            if($(element + ' .qt_lookup ul li').length == data.totalResultCount){
                $('.see-more').hide();
            }
            return true;
        },
        error: function (e) {
        }
    });
    return;
}

function onehrQTLookup(session_role, qtrolemapping, lookupurl, deeplinkurl, actionname, actiontype, actionicon) {
    var self, searchInput, iconholder, searchSuggestions, searchSuggestions_progress, searchSuggestions_results, searchSuggestions_more, key, searchTimeout, activeEl, activeIndex = -1, count, defaultValue;
    self = this;
    searchInput = $("#accordion-sidebar").find(actionname).find("input[data-ws='PS']");
    if (searchInput.parent().siblings(".qt_lookup").length == 0) {
        searchSuggestions = $("<div>", {'class': "qt_lookup", id: "qt_lookup"});
        searchSuggestions.append("<ul>", $("<div>", {'class': "more"}).append($("<a>", {title: "See More Results", href: "#", 'class': "see-more"}).hide().text("See More...")), $("<div>", {'class': "progress"}).append($("<div>", {'class': "indicator"}).text("Loading...")));
        searchSuggestions.hide().insertAfter(searchInput.parent());
    } else {
        searchSuggestions = searchInput.parent().siblings(".qt_lookup");
    }
    searchSuggestions_progress = searchSuggestions.find(".progress");
    searchSuggestions_results = searchSuggestions.find("ul");
    searchSuggestions_more = searchSuggestions.find(".see-more").hide();
    searchInput.val(unescape(searchInput.val()));
    inputdata = "";
    searchSuggestions.isMouseLeave = false;
    searchSuggestions.mouseenter(function (e) {
        searchSuggestions.isMouseLeave = false;
    }).mouseleave(function () {
        searchSuggestions.isMouseLeave = true;
    });

    key = {
        SHIFT: 16,
        UP: 38,
        DOWN: 40,
        DEL: 46,
        TAB: 9,
        RETURN: 13,
        ESC: 27,
        COMMA: 188,
        PAGEUP: 33,
        PAGEDOWN: 34,
        BACKSPACE: 8
    };

    defaultValue = "Enter a name or SSO.";
    searchInput.val("");
    searchInput.unbind('blur');
    searchInput.unbind('focus');
    searchInput.blur(function (e) {
        if ($.trim(searchInput.val()) === "") {
            searchInput.val(defaultValue).css({color: "#cccccc"});
        }
        if (!searchSuggestions.isMouseLeave) {
            return false;
        }
        searchSuggestions.hide();
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        searchSuggestions.isOpened = false;
        return false;
    });
    if ($.trim(searchInput.val()) === "") {
        searchInput.val(defaultValue).css({color: "#cccccc"});
    }
    searchInput.focus(function (e) {
        if ($(this).val() === defaultValue) {
            $(this).val("").css({color: "#666666"});
        }
    }).bind("keyup", function (e) {
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        var $input, value, jsonInput, code;
        $input = $(this);
        value = $input.val().substring($input.val().lastIndexOf(';') + 1, $input.val().length);
        jsonInput = {
            userDirectoryLookup: lookupurl,
        }
        code = (e.keyCode ? e.keyCode : e.which);
        if (searchSuggestions.isOpened && (code === key.RETURN) && (activeIndex > -1)) {
            searchSuggestions.find("a.active").trigger("click");
            return false;
        }
        if ((code === key.ESC) || ((code === key.BACKSPACE) && (value === "")) || ((code === key.RETURN) && (value === "") && (activeIndex > -1))) {
            searchSuggestions.hide();
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            searchSuggestions.isOpened = false;
            return false;
        }
        if (searchSuggestions.isOpened && (code === key.DOWN)) {
            count = searchSuggestions.find("a").length;
            $(searchSuggestions.find("a")[activeIndex]).removeClass("active");
            (activeIndex < (count - 1)) ? (activeIndex += 1) : (activeIndex = 0);
            activeEl = $(searchSuggestions.find("a")[activeIndex]).addClass("active");
            searchSuggestions_results[0].scrollTo(activeEl.position().top);
            return false;
        }
        if (searchSuggestions.isOpened && (code === key.UP)) {
            count = searchSuggestions.find("a").length;
            $(searchSuggestions.find("a")[activeIndex]).removeClass("active");
            (activeIndex > 0) ? (activeIndex -= 1) : (activeIndex = (count - 1));
            activeEl = $(searchSuggestions.find("a")[activeIndex]).addClass("active");
            searchSuggestions_results[0].scrollTo(activeEl.position().top);
            return false;
        }
        if (((value !== "") && (value !== defaultValue)) && ((code === key.BACKSPACE) || (code === key.RETURN) || ((code >= 46) && (code <= 105)) || (code === key.SHIFT) || (code === 17) || ((e.type === "keyup") && (!e.keyCode)))) {
            searchTimeout = setTimeout(function () {
                searchSuggestions.isOpened = true;
                searchSuggestions.show();
                searchSuggestions_results.hide();
                searchSuggestions_more.hide();
                searchSuggestions_progress.show();
                var page = 1;
                getDirectoryList(session_role, qtrolemapping, lookupurl, jsonInput, page, value, function (directoryList) {
                    var page = 1;
                    searchSuggestions_results.html("");
                    if(directoryList.statuscode == "EXCEPTION"){
                         $("<li class='sug'><p>" + directoryList.exceptiondisplaymsg + "</p></li>").appendTo(searchSuggestions_results);
                         searchSuggestions_results.addClass("noData");
                    } else if (directoryList.statuscode != undefined && directoryList.statuscode == "OUTAGE") {
                        $("<li class='sug'><p>" + directoryList.statusmesssage + "</p></li>").appendTo(searchSuggestions_results);
                        searchSuggestions_results.addClass("noData");
                    } else if (directoryList.data.length) {
                        $(directoryList.data).each(function (i, user) {
                            if(glbSiteName == "GE_MNGRVIEW"){
                                var trans_link = deeplinkurl + "?varTransType=" + actiontype + "&varEmpSSO=" + user.sso;
                                $("<li><a href=" + trans_link + " target='_blank' rel='" + user.sso + "'><span class='name'>" + user.lastName + ', ' + user.firstName + "</span>" + (user.sso ? " <span class='business'>(" + user.sso + ")</span>" : "") + "</a></li>").appendTo(searchSuggestions_results);
                            }else{
                                var trans_link = deeplinkurl + "?varTransType=" + actiontype + "&varEmpSSO=" + user.publicData.sso;
                                $("<li><a href=" + trans_link + " target='_blank' rel='" + user.publicData.sso + "'><span class='name'>" + user.publicData.lastName + ', ' + user.publicData.firstName + "</span>" + (user.publicData.sso ? " <span class='business'>(" + user.publicData.sso + ")</span>" : "") + "</a></li>").appendTo(searchSuggestions_results);
                            }
                        });
                        searchSuggestions_results.removeClass("noData");
                    } else {
                        if(glbSiteName == "GE_MNGRVIEW"){
                            $("<li><p>Cannot load '" + value + "'</p></li><li class='sug'><p>You may only search your employees.</p></li>").appendTo(searchSuggestions_results);
                        }else{
                            $("<li><p>Couldn't find '" + value + "'</p></li><li class='sug'><p>Please check your text and try again</p></li>").appendTo(searchSuggestions_results);
                        }
                        searchSuggestions_results.addClass("noData");
                    }
                    searchSuggestions_progress.hide();
                    searchSuggestions_results.show();
                    searchSuggestions_more.unbind();
                    searchSuggestions_results.jScrollPane({scrollbarWidth: 7, scrollbarMargin: 1, animateTo: true, animateInterval: 50, animateStep: 3});
                    if ((searchSuggestions_results.find("li").length < 4)) {
                        searchSuggestions_results.jScrollPaneRemove();
                    }
                    if (directoryList.next) {
                        searchSuggestions_more.css('display', 'block').click(function (e) {
                            page += 1;
                            searchSuggestions_progress.show();
                            getDirectoryList(session_role, qtrolemapping, lookupurl, jsonInput, page, value, function (directoryList) {
                                if (directoryList.data.length) {
                                    $(directoryList.data).each(function (i, user) {
                                        if(glbSiteName == "GE_MNGRVIEW"){
                                            var trans_link = deeplinkurl + "?varTransType=" + actiontype + "&varEmpSSO=" + user.sso;
                                            $("<li><a href=" + trans_link + " target='_blank' rel='" + user.sso + "'><span class='name'>" + user.lastName + ', ' + user.firstName + "</span>" + (user.sso ? " <span class='business'>(" + user.sso + ")</span>" : "") + "</a></li>").appendTo(searchSuggestions_results);
                                        }else{
                                            var trans_link = deeplinkurl + "?varTransType=" + actiontype + "&varEmpSSO=" + user.publicData.sso;
                                            $("<li><a href=" + trans_link + " target='_blank' rel='" + user.publicData.sso + "'><span class='name'>" + user.publicData.lastName + ', ' + user.publicData.firstName + "</span>" + (user.publicData.sso ? " <span class='business'>(" + user.publicData.sso + ")</span>" : "") + "</a></li>").appendTo(searchSuggestions_results);
                                        }
                                    });
                                    if (directoryList.next && (directoryList.next === "FALSE")) {
                                        searchSuggestions_more.unbind().hide();
                                    }
                                    count = searchSuggestions.find("a").length;
                                    $(searchSuggestions.find("a")[activeIndex]).removeClass("active");
                                    activeIndex = (count - 1);
                                    activeEl = $(searchSuggestions.find("a")[activeIndex]).addClass("active");
                                    searchSuggestions_progress.hide();
                                    searchSuggestions_results.jScrollPane({scrollbarWidth: 7, scrollbarMargin: 1, animateTo: true, animateInterval: 50, animateStep: 3});
                                    searchSuggestions_results[0].scrollTo(searchSuggestions_results.data('jScrollPaneMaxScroll'));
                                    searchInput.focus();
                                } else {
                                    $("<li><p>No more results found.</p></li>").appendTo(searchSuggestions_results);
                                }
                            });
                            return false;
                        });
                    }
                });
            }, 1000);
        }
    });

}

$(document).ready(function () {
    $("body").on("click", ".qt_lookup .jScrollPaneContainer a", function () {
        $(this).closest('.accordion-profile-data').prev().trigger('click');
    });

    $('a[data-toggle="tab"]').on('shown', function (e) {
        $(this).blur();
    });

    //Redirect to TH Notifications Dashboard
    $('body').on('click', '.btn-th-notifications', function(){
        THNotificationsService.goToDashboard();
    });
    /*Adding this fix temporary due to each time the page refresh it or request something in the backend automatically
        set all divs inside .portlet-container with transform:traslade3d so it affect the toggle collpase functionality.
    */
    $("#GE_HR_WELCOME,#GE_HR_DASHBOARD").addClass("collapseAction");

});


window.manageDate = window.manageDate || {};
manageDate.Utils = (function () {
    var utils = {
        date: null,
        getDate: function () {
            return utils.date;
        },
        getMonth: function (date) {
            return date.month();
        },
        getLastDayofMonth: function (date) {
            var month = utils.getMonth(date);
            return moment().month(month).endOf('month').get('date');
        },
        setDate: function (date, format) {
            utils.date = moment(date, format);
        },
        prevMonth: function () {
            var date = utils.getDate().subtract(1, 'months'),
                    day = utils.getLastDayofMonth(date),
                    finalDate = date.set('date', day);
            return finalDate;
        },
        nextMonth: function () {
            var date = utils.getDate().add(1, 'months'),
                    day = utils.getLastDayofMonth(date),
                    finalDate = date.set('date', day);
            return finalDate;
        }
    };
    return utils;
}());

var getHrNewsParameters = function(month, valTopic, valType){
    var date = "", parameters = "";

    parameters = 'template=GE_EDS_XSL_HRNEWSROUNDUP&news_type=' + valType +
            '&news_tag=' + valTopic + '&isAjax=true&month=' + month;

    if(month == 0){
        parameters += '&day=-10';
    }else{
        date = moment().format('DD-MM-YYYY');
        parameters += "&date=" + date;
    }

    return parameters;
}


const filterOptions={
    filterByView:()=>{
        if(glbSiteName=="GE_MNGRVIEW"){
            $(".topics option:not(:first)").hide();
        }
    }  
}
    //WATCHER DOM for HRVIEW BETA
    //this watcher acts like ng-watcher in angular1, once it is able to find the DOM it will stop to search.
    //iScript contect is taking to much time to render and we are not able to assign events with jquery once the DOM is ready
    //This mechanism will be aplied in People leader InfoBytes
    const watcher={
        DOM:(obj)=>{
            this.myCallback=()=>{
                if($(obj.selector).length>0){
                        if (obj.hasOwnProperty("fn")) obj.fn();
                    clearInterval(this.foundObj);
              }
            };
            this.foundObj=setInterval(this.myCallback,500);
        }
    }

//execute watcher for topics

watcher.DOM({selector:".topics",fn:filterOptions.filterByView});


$('body').on('click', '.hr-news-date .btn', function (e) {
    e.preventDefault();
    var month = $(this).data("month"), parameters = "",
        valTopic = encodeURIComponent($('.topics').val()), valType = $('.types').val();

    parameters = getHrNewsParameters(month, valTopic, valType);
    watcher.DOM({selector:".topics",fn:filterOptions.filterByView});
    showCMSContent(glbDSWSCmpURL + 'WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_GE_DRNewsArticle', parameters, ".hrnews-container > .cms-widget-row");
});

$('body').on('change', '.topics, .types', function () {
    var valTopic = encodeURIComponent($('.topics').val()), valType = $('.types').val(),
        month = $('.time-frame.active').data('month'), parameters = "";

    parameters = getHrNewsParameters(month, valTopic, valType);
    watcher.DOM({selector:".topics",fn:filterOptions.filterByView});
    showCMSContent(glbDSWSCmpURL + 'WEBLIB_EDS_UTIL.GE_FUNCLIB_FLD.FieldFormula.IScript_GE_DRNewsArticle', parameters, ".hrnews-container > .cms-widget-row");
});

$('body').on('click', '.nav-tabs li', function () {
    var tabReference = $(this).find("a").attr('href');
    var loading = "<div class='communication-loading-widget center'><img src='/m/eds/img/ajax-loader.gif'/></div>";
    /*if (tabReference === "#ideas" && !ge_ideas_map.alreadyRequested) {
        $("#ideas").prepend(loading);
        ge_ideas_map.getIdeasValues();
    } else*/if (tabReference === "#colab" && !ge_colab.alreadyRequested) {
        $("#colab").prepend(loading);
        ge_colab.getPosts();
    }
    watcher.DOM({selector:".topics",fn:filterOptions.filterByView});
});

var moveNotifications = function ($this) {
    var max_width = 375, displacement = "", action = "",
        colab_iframe = document.getElementById('colab-notif-center');

        displacement = !$this.hasClass('open') ? "+=" + max_width + "px" : "-=" + max_width + "px";

    if (!$this.hasClass('open')) {
            action = 'open';
            var category = glbSiteName + "/COLAB/",
                ga = 'COLAB/CLICK';
            _gaq.push(['_trackEvent', category, ga, "Notifications"]);
    } else {
            action = 'close';
        }

        colab_iframe.contentWindow.postMessage(action, '*');
        $this.parent().animate({
            right: displacement,
        }, 500);

        $this.toggleClass('open');
        $('#colab-notif-center').toggleClass('open');
}

$('.notif-center .toggle.empty').click(function(e){
    e.stopImmediatePropagation();
    var script_loaded = $(this).attr('data-loaded'),
        notifications_button = $(this);
    if(!script_loaded){
        var script = document.createElement('script'),
        head = document.getElementsByTagName('head')[0],
        done= false;

        script.type = 'text/javascript';
        script.src = 'https://colab.ge.com/notif_center/notif_center.js?showTab=false';

        head.appendChild(script);

        window.addEventListener('message', function(e){
            switch (e.data) {
                case 'notif_center:ready':
                    //console.log('ready');
                    moveNotifications(notifications_button);
                break;
                case 'notif_center:panel_close':
                    //console.log('close');
                break;
                case 'notif_center:panel_open':
                    //console.log('open');
                break;
            }
        });

        notifications_button.attr('data-loaded', 'loaded');
    }else{
        moveNotifications(notifications_button);
    }
});

$('body').click(function (e) {
    if ($('.notif-center .toggle.empty').hasClass('open')) {
        moveNotifications($('.notif-center .toggle.empty'));
    }
})

var rtable = /^t(?:able|d|h)$/i,
        rroot = /^(?:body|html)$/i;

function getWindow(elem) {
    return jQuery.isWindow(elem) ?
            elem :
            elem.nodeType === 9 ?
            elem.defaultView || elem.parentWindow :
            false;
}

if ("getBoundingClientRect" in document.documentElement) {
    jQuery.fn.offset = function (options) {
        var elem = this[0], box;

        if (options) {
            return this.each(function (i) {
                jQuery.offset.setOffset(this, options, i);
            });
        }

        if (!elem || !elem.ownerDocument) {
            return null;
        }

        if (elem === elem.ownerDocument.body) {
            if (typeof bodyOffset == 'function'){
                return jQuery.offset.bodyOffset(elem);
            }
        }

        try {
            box = elem.getBoundingClientRect();
        } catch (e) {
        }

        var doc = elem.ownerDocument,
                docElem = doc.documentElement;

        // Make sure we're not dealing with a disconnected DOM node
        if (!box || !jQuery.contains(docElem, elem)) {
            return box ? {top: box.top, left: box.left} : {top: 0, left: 0};
        }

        var body = doc.body,
                win = getWindow(doc),
                clientTop = docElem.clientTop || body.clientTop || 0,
                clientLeft = docElem.clientLeft || body.clientLeft || 0,
                scrollTop = win.pageYOffset || jQuery.support.boxModel && docElem.scrollTop || body.scrollTop,
                scrollLeft = win.pageXOffset || jQuery.support.boxModel && docElem.scrollLeft || body.scrollLeft,
                top = box.top + scrollTop - clientTop,
                left = box.left + scrollLeft - clientLeft;

        return {top: top, left: left};
    };

} else {
    jQuery.fn.offset = function (options) {
        var elem = this[0];

        if (options) {
            return this.each(function (i) {
                jQuery.offset.setOffset(this, options, i);
            });
        }

        if (!elem || !elem.ownerDocument) {
            return null;
        }

        if (elem === elem.ownerDocument.body) {
            return jQuery.offset.bodyOffset(elem);
        }

        var computedStyle,
                offsetParent = elem.offsetParent,
                prevOffsetParent = elem,
                doc = elem.ownerDocument,
                docElem = doc.documentElement,
                body = doc.body,
                defaultView = doc.defaultView,
                prevComputedStyle = defaultView ? defaultView.getComputedStyle(elem, null) : elem.currentStyle,
                top = elem.offsetTop,
                left = elem.offsetLeft;

        while ((elem = elem.parentNode) && elem !== body && elem !== docElem) {
            if (jQuery.support.fixedPosition && prevComputedStyle.position === "fixed") {
                break;
            }

            computedStyle = defaultView ? defaultView.getComputedStyle(elem, null) : elem.currentStyle;
            top -= elem.scrollTop;
            left -= elem.scrollLeft;

            if (elem === offsetParent) {
                top += elem.offsetTop;
                left += elem.offsetLeft;

                if (jQuery.support.doesNotAddBorder && !(jQuery.support.doesAddBorderForTableAndCells && rtable.test(elem.nodeName))) {
                    top += parseFloat(computedStyle.borderTopWidth) || 0;
                    left += parseFloat(computedStyle.borderLeftWidth) || 0;
                }

                prevOffsetParent = offsetParent;
                offsetParent = elem.offsetParent;
            }

            if (jQuery.support.subtractsBorderForOverflowNotVisible && computedStyle.overflow !== "visible") {
                top += parseFloat(computedStyle.borderTopWidth) || 0;
                left += parseFloat(computedStyle.borderLeftWidth) || 0;
            }

            prevComputedStyle = computedStyle;
        }

        if (prevComputedStyle.position === "relative" || prevComputedStyle.position === "static") {
            top += body.offsetTop;
            left += body.offsetLeft;
        }

        if (jQuery.support.fixedPosition && prevComputedStyle.position === "fixed") {
            top += Math.max(docElem.scrollTop, body.scrollTop);
            left += Math.max(docElem.scrollLeft, body.scrollLeft);
        }

        return {top: top, left: left};
    };
}
