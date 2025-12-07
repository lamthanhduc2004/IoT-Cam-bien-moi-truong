import { useState, useEffect, useCallback } from 'react';
import { FaChevronLeft, FaChevronRight, FaCalendar } from 'react-icons/fa';
import apiService from '../services/api';
import { PAGINATION, DATE_FORMAT } from '../config/constants';
import './DataSensor.css';

const DataSensor = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [sensorData, setSensorData] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(PAGINATION.DEFAULT_PAGE_SIZE);
  const [orderBy, setOrderBy] = useState('timestamp');
  const [orderDir, setOrderDir] = useState('DESC');
  const [sortState, setSortState] = useState({});
  
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
    const fetchData = async () => {
      setLoading(true);
      const result = await apiService.getSensors(
        currentPage, 
        itemsPerPage, 
        searchTerm, 
        filterType,
        orderBy,
        orderDir,
        selectedDate
      );
      
      if (result && result.data) {
        const formatted = result.data.map((item, index) => ({
          id: item.id,
          stt: (currentPage - 1) * itemsPerPage + index + 1,
          temperature: item.temperature != null ? item.temperature.toFixed(1) : '-',
          humidity: item.humidity != null ? item.humidity.toFixed(1) : '-',
          light: item.light != null ? item.light.toFixed(0) : '-',
          rainfall: item.rainfall != null ? item.rainfall.toFixed(2) : '-',
          wind_speed: item.wind_speed != null ? item.wind_speed.toFixed(2) : '-',
          time: new Date(item.timestamp).toLocaleString(DATE_FORMAT.LOCALE),
          rawTimestamp: item.timestamp
        }));

        setSensorData(formatted);
        setTotalRecords(result.total || 0);
      }
      setLoading(false);
    };

    fetchData();
  }, [currentPage, itemsPerPage, searchTerm, filterType, orderBy, orderDir, selectedDate]);

  const handleSort = useCallback((column) => {
    const currentState = sortState[column] || 'none';
    let newState, newOrderBy, newOrderDir;

    if (currentState === 'none') {
      newState = 'asc';
      newOrderBy = column;
      newOrderDir = 'ASC';
    } else if (currentState === 'asc') {
      newState = 'desc';
      newOrderBy = column;
      newOrderDir = 'DESC';
    } else {
      newState = 'none';
      newOrderBy = 'timestamp';
      newOrderDir = 'DESC';
    }

    setSortState({ [column]: newState });
    setOrderBy(newOrderBy);
    setOrderDir(newOrderDir);
    setCurrentPage(1);
  }, [sortState]);

  const handleCopyTime = useCallback((timestamp) => {
    navigator.clipboard.writeText(timestamp);
  }, []);

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
    <div className="data-sensor">
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
          ({totalRecords} records)
        </span>
      </div>

      <div className="search-section">
        <input
          type="text"
          className="search-input"
          placeholder="Tìm kiếm dữ liệu: Nhiệt độ, độ ẩm, ánh sáng, thời gian"
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
          <option>Temperature</option>
          <option>Humidity</option>
          <option>Light</option>
          <option>Rainfall</option>
          <option>Wind_speed</option>
        </select>
        <button 
          className="search-btn"
          onClick={handleSearch}
        >
          Search
        </button>
      </div>

      <div className="table-container">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#00b4d8' }}>
            Loading...
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ cursor: 'default' }}>
                  STT
                </th>
                <th onClick={() => handleSort('temperature')} style={{ cursor: 'pointer' }}>
                  Temperature(°C) {sortState['temperature'] === 'asc' ? '↑' : sortState['temperature'] === 'desc' ? '↓' : ''}
                </th>
                <th onClick={() => handleSort('humidity')} style={{ cursor: 'pointer' }}>
                  Humidity(%) {sortState['humidity'] === 'asc' ? '↑' : sortState['humidity'] === 'desc' ? '↓' : ''}
                </th>
                <th onClick={() => handleSort('light')} style={{ cursor: 'pointer' }}>
                  Light(nits) {sortState['light'] === 'asc' ? '↑' : sortState['light'] === 'desc' ? '↓' : ''}
                </th>
                <th onClick={() => handleSort('rainfall')} style={{ cursor: 'pointer' }}>
                  Rainfall(mm) {sortState['rainfall'] === 'asc' ? '↑' : sortState['rainfall'] === 'desc' ? '↓' : ''}
                </th>
                <th onClick={() => handleSort('wind_speed')} style={{ cursor: 'pointer' }}>
                  Wind Speed(m/s) {sortState['wind_speed'] === 'asc' ? '↑' : sortState['wind_speed'] === 'desc' ? '↓' : ''}
                </th>
                <th onClick={() => handleSort('timestamp')} style={{ cursor: 'pointer' }}>
                  Time {sortState['timestamp'] === 'asc' ? '↑' : sortState['timestamp'] === 'desc' ? '↓' : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {sensorData.length > 0 ? (
                sensorData.map((row, index) => (
                  <tr key={row.id} className={index % 2 === 0 ? 'even' : 'odd'}>
                    <td>{row.stt}</td>
                    <td>{row.temperature}</td>
                    <td>{row.humidity}</td>
                    <td>{row.light}</td>
                    <td>{row.rainfall}</td>
                    <td>{row.wind_speed}</td>
                    <td 
                      onClick={() => handleCopyTime(row.time)}
                      style={{ cursor: 'pointer' }}
                      title="Click to copy"
                    >
                      {row.time}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>
                    No data available for {selectedDate}
                  </td>
                </tr>
              )}
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
              className={`page-btn ${currentPage === page ? 'active' : ''}`}
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

export default DataSensor;
