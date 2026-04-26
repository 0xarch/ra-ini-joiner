export const File = {
    parse_path_separators(path) {
        if (typeof path !== 'string') return '';
        return path.replace(/\\/g, '/');
    },
    parse_start_char(path) {
        let formatted_path = path;
        if (formatted_path.startsWith('./')) formatted_path = formatted_path.slice(2);
        if (formatted_path.startsWith('/')) formatted_path = formatted_path.slice(1);
        if (formatted_path.endsWith('/')) formatted_path = formatted_path.slice(0, -1);
        return formatted_path;
    },
    format_path(path) {
        let formatted_path = this.parse_path_separators(path);
        formatted_path = this.parse_start_char(formatted_path);

        const match_drive = formatted_path.match(/^([A-Za-z]:)\//);
        if (match_drive) {
            formatted_path = match_drive[1] + formatted_path.slice(match_drive[0].length - 1);
        }

        return formatted_path;
    },
    has_special_dir(path) {
        const parts = path.split('/');
        return parts.some(part => part === '.' || part === '..');
    },
    pattern_to_regex(pattern) {
        let result_pattern = this.parse_path_separators(pattern);
        result_pattern = this.parse_start_char(result_pattern);

        let hasDrive = false;
        let drivePrefix = '';
        const driveMatch = result_pattern.match(/^([A-Za-z]:)/);
        if (driveMatch) {
            hasDrive = true;
            drivePrefix = driveMatch[1];
            result_pattern = result_pattern.slice(drivePrefix.length);
            if (result_pattern.startsWith('/')) result_pattern = result_pattern.slice(1);
        }

        if (result_pattern === '') {
            return hasDrive ? new RegExp('^' + drivePrefix + '$') : /^$/;
        }

        let result = '';
        let i = 0;

        while (i < result_pattern.length) {
            const ch = result_pattern[i];

            if (ch === '*') {
                if (i + 1 < result_pattern.length && result_pattern[i + 1] === '*') {
                    if (i + 2 < result_pattern.length && result_pattern[i + 2] === '/') {
                        result += '(?:(?!\\.{1,2}$)[^/]+/)*';
                        i += 3;
                    } else {
                        result += '(?:(?!\\.{1,2}(?:/|$)).)*';
                        i += 2;
                    }
                } else {
                    result += '(?!\\.{1,2}$)[^/]+';
                    i += 1;
                }
            } else if (ch === '?') {
                result += '[^/]';
                i += 1;
            } else if ('\\^$.[]|()?+{}'.includes(ch)) {
                result += '\\' + ch;
                i += 1;
            } else {
                result += ch;
                i += 1;
            }
        }

        let regexPattern = '^' + result + '$';
        if (hasDrive) {
            regexPattern = '^' + drivePrefix + '/' + result + '$';
        }

        return new RegExp(regexPattern);
    }
}