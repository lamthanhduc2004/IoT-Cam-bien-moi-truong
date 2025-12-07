import { useState, useEffect, useCallback } from 'react';
import { FaChevronLeft, FaChevronRight, FaCalendar, FaFilter } from 'react-icons/fa';
import apiService from '../services/api';
import { PAGINATION, DATE_FORMAT } from '../config/constants';
import './ActionHistory.css';

const ActionHistory = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [historyData, setHistoryData] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(PAGINATION.DEFAULT_PAGE_SIZE);
  const [orderBy, setOrderBy] = useState('timestamp');
  const [orderDir, setOrderDir] = useState('DESC');
  const [sortState, setSortState] = useState({});
  
  const [deviceFilter, setDeviceFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const [showActionDropdown, setShowActionDropdown] = useState(false);

  const getTodayDate = useCallback(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState(() => getTodayDate());
  const [isManualDateSelection, setIsManualDateSelection] = useState(false);

  const totalPages = Math.ceil(totalRecords / itemsPerPage);

  useEffect(() => {
    const checkDate = setInterval(() => {
      const currentDate = getTodayDate();
      if (!isManualDateSelection && selectedDate !== currentDate) {
        setSelectedDate(currentDate);
      }
    }, 60000);

    return () => clearInterval(checkDate);
  }, [selectedDate, isManualDateSelection, getTodayDate]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.th-with-filter')) {
        setShowDeviceDropdown(false);
        setShowActionDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      let combinedFilter = filterType;
      if (deviceFilter !== 'All') {
        combinedFilter = deviceFilter.toLowerCase();
      }
      
      let combinedSearch = searchTerm;
      if (actionFilter !== 'All' && !searchTerm) {
        combinedSearch = actionFilter;
      }
      
      const result = await apiService.getActions(
        currentPage,
        itemsPerPage,
        combinedSearch,
        combinedFilter,
        orderBy,
        orderDir,
        selectedDate
      );

      if (result && result.data) {
        const formatted = result.data.map((item, index) => ({
          id: item.id,
          stt: (currentPage - 1) * itemsPerPage + index + 1,
          device: item.target ? item.target.toUpperCase() : 'UNKNOWN',
          action: item.action,
          time: new Date(item.timestamp).toLocaleString(DATE_FORMAT.LOCALE),
          rawTimestamp: item.timestamp,
          issued_by: item.issued_by || 'system'
        }));
        setHistoryData(formatted);
        setTotalRecords(result.total || 0);
      } else {
        setHistoryData([]);
        setTotalRecords(0);
      }
      setLoading(false);
    };

    fetchData();
  }, [currentPage, itemsPerPage, searchTerm, filterType, orderBy, orderDir, selectedDate, deviceFilter, actionFilter]);

  const handleSearch = useCallback(() => {
    setSearchTerm(searchInput);
    setCurrentPage(1);
  }, [searchInput]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  const handleDateChange = useCallback((e) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    setCurrentPage(1);
    setIsManualDateSelection(newDate !== getTodayDate());
  }, [getTodayDate]);

  const handleToday = useCallback(() => {
    const today = getTodayDate();
    setSelectedDate(today);
    setCurrentPage(1);
    setIsManualDateSelection(false);
  }, [getTodayDate]);

  const handleYesterday = useCallback(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayStr = `${year}-${month}-${day}`;
    setSelectedDate(yesterdayStr);
    setCurrentPage(1);
    setIsManualDateSelection(true);
  }, []);

  const handleSort = useCallback((column) => {
    let newDir = 'ASC';
    let newState = { ...sortState };

    if (sortState[column] === 'ASC') {
      newDir = 'DESC';
      newState[column] = 'DESC';
    } else if (sortState[column] === 'DESC') {
      newDir = 'DESC';
      newState = {};
      setOrderBy('timestamp');
      setOrderDir('DESC');
      setSortState({});
      return;
    } else {
      newState = { [column]: 'ASC' };
    }

    setSortState(newState);
    setOrderBy(column);
    setOrderDir(newDir);
    setCurrentPage(1);
  }, [sortState]);

  const handleCopyTime = useCallback((time) => {
    navigator.clipboard.writeText(time);
  }, []);

  const handleDeviceFilter = useCallback((device) => {
    setDeviceFilter(device);
    setShowDeviceDropdown(false);
    setCurrentPage(1);
  }, []);

  const handleActionFilter = useCallback((action) => {
    setActionFilter(action);
    setShowActionDropdown(false);
    setCurrentPage(1);
  }, []);

  const getPageNumbers = useCallback(() => {
    const pages = [];
    if (totalPages <= PAGINATION.MAX_PAGE_BUTTONS) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  }, [totalPages, currentPage]);

  return (
    <div className="action-history">
      <div className="date-section">
        <FaCalendar className="calendar-icon" />
        <button className="date-quick-btn" onClick={handleToday}>
          Hôm nay
        </button>
        <button className="date-quick-btn" onClick={handleYesterday}>
          Hôm qua
        </button>
        <input
          type="date"
          className="date-input"
          value={selectedDate}
          onChange={handleDateChange}
          max={getTodayDate()}
        />
        <span className="date-label">
          ({totalRecords} actions)
        </span>
      </div>

      <div className="search-section">
        <input
          type="text"
          className="search-input"
          placeholder="Tìm kiếm: Thiết bị, hành động, thời gian"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        <select
          className="filter-select"
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option>All</option>
          <option>fan</option>
          <option>ac</option>
          <option>led</option>
        </select>
        <button className="search-btn" onClick={handleSearch}>
          Search
        </button>
      </div>

      <div className="table-container">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#00b4d8' }}>
            Loading...
          </div>
        ) : historyData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
            No action history for {selectedDate}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ cursor: 'default' }}>STT</th>
                <th className="th-with-filter">
                  <div className="th-content">
                    <span 
                      className="th-text"
                      onClick={() => setShowDeviceDropdown(!showDeviceDropdown)}
                    >
                      Device 
                      {deviceFilter !== 'All' && <span className="filter-badge">{deviceFilter}</span>}
                      <FaFilter className="filter-icon" />
                    </span>
                  </div>
                  {showDeviceDropdown && (
                    <div className="filter-dropdown">
                      <div 
                        className={`dropdown-item ${deviceFilter === 'All' ? 'active' : ''}`}
                        onClick={() => handleDeviceFilter('All')}
                      >
                        All Devices
                      </div>
                      <div 
                        className={`dropdown-item ${deviceFilter === 'LED' ? 'active' : ''}`}
                        onClick={() => handleDeviceFilter('LED')}
                      >
                        LED
                      </div>
                      <div 
                        className={`dropdown-item ${deviceFilter === 'FAN' ? 'active' : ''}`}
                        onClick={() => handleDeviceFilter('FAN')}
                      >
                        FAN
                      </div>
                      <div 
                        className={`dropdown-item ${deviceFilter === 'AC' ? 'active' : ''}`}
                        onClick={() => handleDeviceFilter('AC')}
                      >
                        AC
                      </div>
                    </div>
                  )}
                </th>
                <th className="th-with-filter">
                  <div className="th-content">
                    <span 
                      className="th-text"
                      onClick={() => setShowActionDropdown(!showActionDropdown)}
                    >
                      Action 
                      {actionFilter !== 'All' && <span className="filter-badge">{actionFilter}</span>}
                      <FaFilter className="filter-icon" />
                    </span>
                  </div>
                  {showActionDropdown && (
                    <div className="filter-dropdown">
                      <div 
                        className={`dropdown-item ${actionFilter === 'All' ? 'active' : ''}`}
                        onClick={() => handleActionFilter('All')}
                      >
                        All Actions
                      </div>
                      <div 
                        className={`dropdown-item ${actionFilter === 'ON' ? 'active' : ''}`}
                        onClick={() => handleActionFilter('ON')}
                      >
                        ON
                      </div>
                      <div 
                        className={`dropdown-item ${actionFilter === 'OFF' ? 'active' : ''}`}
                        onClick={() => handleActionFilter('OFF')}
                      >
                        OFF
                      </div>
                    </div>
                  )}
                </th>
                <th onClick={() => handleSort('timestamp')} style={{ cursor: 'pointer' }}>
                  Time {sortState['timestamp'] === 'ASC' ? '↑' : sortState['timestamp'] === 'DESC' ? '↓' : '⇅'}
                </th>
              </tr>
            </thead>
            <tbody>
              {historyData.map((row, index) => (
                <tr key={row.id} className={index % 2 === 0 ? 'even' : 'odd'}>
                  <td>{row.stt}</td>
                  <td>{row.device}</td>
                  <td>{row.action}</td>
                  <td 
                    onClick={() => handleCopyTime(row.time)}
                    style={{ cursor: 'pointer' }}
                    title="Click to copy"
                  >
                    {row.time}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="pagination">
        <button 
          className="page-btn arrow"
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          <FaChevronLeft />
        </button>

        {getPageNumbers().map((page, index) => (
          page === '...' ? (
            <span key={`ellipsis-${index}`} className="ellipsis">...</span>
          ) : (
            <button
              key={page}
              className={`page-btn ${page === currentPage ? 'active' : ''}`}
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </button>
          )
        ))}

        <button 
          className="page-btn arrow"
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          <FaChevronRight />
        </button>

        <select 
          className="items-per-page"
          value={itemsPerPage}
          onChange={(e) => {
            setItemsPerPage(Number(e.target.value));
            setCurrentPage(1);
          }}
        >
          {PAGINATION.PAGE_SIZE_OPTIONS.map(size => (
            <option key={size} value={size}>{size}/page</option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default ActionHistory;
