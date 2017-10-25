<?php

$html = file_get_contents('index.html.bak');
$html = preg_replace_callback('!<div class="l" data-i18n="([^"]+)">([^<]+)</div>!', function ($m) {
    return "<div class=\"l\" data-link=\"{i18n:'{$m[1]}' '{$m[2]}'}\"></div>\n";
}, $html);
echo $html;
